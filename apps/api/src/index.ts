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
import { apiEnvSchema } from "./env.js";
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

let env;
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
        const { scrapeFromHtml } = await import("./snapshot-scrape.js");
        return scrapeFromHtml(input);
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

let accessAuth: AccessAuth | undefined;
if (env?.MONGO_URL) {
  try {
    accessAuth = await createAccess(env);
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : "access failed" },
      "account sign-in failed to start",
    );
  }
}

if (env) {
  if (accessAuth) {
    app.all(`${ACCESS_PATH}/{*path}`, toNodeHandler(accessAuth));
  } else {
    app.all(`${ACCESS_PATH}/{*path}`, (_req, res) => {
      res.status(503).json({
        ok: false,
        error: { code: "AUTH_UNAVAILABLE", message: "Set MONGO_URL to enable accounts." },
      });
    });
  }
  app.use(express.json({ limit: "20mb" }));
  if (accessAuth && env.MONGO_URL) {
    const auth = accessAuth;
    const mongoUrl = env.MONGO_URL;
    await ensureAdminDataStores(mongoUrl).catch((error: unknown) => {
      logger.warn(
        { err: error instanceof Error ? error.message : "store setup failed" },
        "mongo stores",
      );
    });
    await ensureAdminAccount({
      auth,
      mongoUrl,
      email: env.ADMIN_BOOTSTRAP_EMAIL,
      password: env.ADMIN_BOOTSTRAP_PASSWORD,
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
      createAdminOverviewRouter({ mongoUrl, auth, adminAppUrl: env.ADMIN_APP_URL }),
    );
  }
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
}

if (env) {
  app.post("/listings", createListing);
  app.post("/listings/sell-similar", sellSimilar);
  app.get(
    "/listings/scrape/progress",
    createScrapeProgressHandler(env.SCRAPER_WORKER_URL, liveScrape),
  );
  app.post("/listings/scrape-cache/clear", clearScrapeCacheHandler);
}

const cacheBackend = env ? await configureScrapeCache(env.REDIS_URL) : "memory";

export default app;

if (!process.env.VERCEL && env) {
  app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, cacheBackend }, "api listening");
  });
}
