import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import morgan from "morgan";
import { ACCESS_PATH, createAccess, type AccessAuth } from "./access.js";
import { ensureAdminAccount } from "./admin/ensure-admin.js";
import { createAdminOverviewRouter } from "./admin/overview.js";
import { requireAdmin } from "./admin/require-admin.js";
import { ensureAdminDataStores } from "./admin/ensure-db.js";
import { createExtensionReleaseHandlers } from "./controllers/ExtensionReleaseController.js";
import {
  clearScrapeCacheHandler,
  createListing,
  createScrapeListingHandler,
  createScrapeProgressHandler,
  sellSimilar,
} from "./controllers/ListingsController.js";
import { createScrapeJobsHandlers } from "./controllers/ScrapeJobsController.js";
import { correlationMiddleware } from "./correlation.js";
import { corsMiddleware } from "./cors.js";
import { apiEnvSchema, type ApiEnv } from "./env.js";
import { configureScrapeCache } from "./scrape-cache.js";

loadRootEnv();

const app = express();
app.use(morgan("tiny"));
app.use(correlationMiddleware);
app.use(corsMiddleware);

const logger = createLogger({ name: "api", level: process.env.LOG_LEVEL ?? "info" });
let bootError: string | undefined;

app.get("/health", (req, res) => {
  if (bootError) {
    res.status(500).json({ ok: false, service: "api", error: bootError });
    return;
  }
  const body: HealthResponse = { ok: true, service: "api" };
  withCorrelationId(logger, req.correlationId).info("health check");
  res.json(body);
});

let env: ApiEnv | undefined;
try {
  env = loadEnv(apiEnvSchema);
} catch (error) {
  bootError = error instanceof Error ? error.message : "Invalid environment configuration";
  logger.error({ err: bootError }, "api failed to read environment");
}

const liveScrape = process.env.VERCEL
  ? {
      scrapeInProcess: async (input: {
        listingUrl: string;
        html?: string;
        scrapeMode?: "full-scrape" | "only-fitment";
      }) => {
        try {
          const { scrapeFromHtml } = await import("./snapshot-scrape.js");
          return await scrapeFromHtml(input);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Scrape failed";
          logger.error({ err: message }, "in-process scrape failed");
          return {
            status: "failed" as const,
            code: "500",
            message,
          };
        }
      },
      readProgress: () => ({
        active: false,
        listingUrl: "",
        stage: null,
        message: "",
        fitmentPage: 0,
        fitmentRows: 0,
        startedAt: null,
        updatedAt: Date.now(),
      }),
    }
  : {};

function rejectAccounts(_req: express.Request, res: express.Response): void {
  res.status(503).json({
    ok: false,
    error: { code: "AUTH_UNAVAILABLE", message: "Set MONGO_URL to enable accounts." },
  });
}

if (env) {
  app.use(express.json({ limit: "20mb" }));
  const extensionRelease = createExtensionReleaseHandlers();
  app.get("/extension/release", extensionRelease.releaseInfo);
  app.get("/extension/download", extensionRelease.download);
  app.post(
    "/listings/scrape",
    createScrapeListingHandler(env.SCRAPER_WORKER_URL, {
      mongoUrl: env.MONGO_URL,
      ...liveScrape,
    }),
  );
  const scrapeJobs = createScrapeJobsHandlers(env);
  app.post("/listings/scrape-jobs", scrapeJobs.createScrapeJob);
  app.get("/listings/scrape-jobs/:jobId", scrapeJobs.getScrapeJob);
  app.post("/listings", createListing);
  app.post("/listings/sell-similar", sellSimilar);
  app.get(
    "/listings/scrape/progress",
    createScrapeProgressHandler(env.SCRAPER_WORKER_URL, liveScrape),
  );
  app.post("/listings/scrape-cache/clear", clearScrapeCacheHandler);
  void bootAccounts(env);
}

async function bootAccounts(current: ApiEnv): Promise<void> {
  if (!current.MONGO_URL) {
    app.all(`${ACCESS_PATH}/{*path}`, rejectAccounts);
    return;
  }
  try {
    const auth: AccessAuth = await createAccess(current);
    app.all(`${ACCESS_PATH}/{*path}`, toNodeHandler(auth));
    const mongoUrl = current.MONGO_URL;
    await ensureAdminDataStores(mongoUrl).catch((error: unknown) => {
      logger.warn(
        { err: error instanceof Error ? error.message : "store setup failed" },
        "mongo stores",
      );
    });
    await ensureAdminAccount({
      auth,
      mongoUrl,
      email: current.ADMIN_BOOTSTRAP_EMAIL,
      password: current.ADMIN_BOOTSTRAP_PASSWORD,
      logger,
    }).catch((error: unknown) => {
      logger.warn(
        { err: error instanceof Error ? error.message : "admin setup failed" },
        "admin account",
      );
    });
    app.use(
      "/api/v1/admin",
      requireAdmin(auth),
      createAdminOverviewRouter({ mongoUrl, auth, adminAppUrl: current.ADMIN_APP_URL }),
    );
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : "access failed" },
      "account sign-in failed to start",
    );
    app.all(`${ACCESS_PATH}/{*path}`, rejectAccounts);
  }
}

const cacheBackend = env ? await configureScrapeCache(env.REDIS_URL) : "memory";

export default app;

if (!process.env.VERCEL && env) {
  app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, cacheBackend }, "api listening");
  });
}
