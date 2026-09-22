import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import morgan from "morgan";
import { createAuth } from "./auth.js";
import { createAdminRouter } from "./admin/router.js";
import { bootstrapAdminAccount } from "./admin/bootstrap.js";
import { ensureAdminDataStores } from "./admin/ensure-db.js";
import { createAccountHandlers } from "./controllers/AccountController.js";
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
import { mailDeliveryEnabled, peekVerificationLink } from "./mail.js";

loadRootEnv();

const env = loadEnv(apiEnvSchema);
const logger = createLogger({ name: "api", level: env.LOG_LEVEL });

const app = express();
app.use(morgan("tiny"));
app.use(correlationMiddleware);
app.use(corsMiddleware);

if (env.MONGO_URL) {
  const auth = await createAuth(env);
  const account = createAccountHandlers(auth, env.MONGO_URL);
  app.all("/api/auth/{*path}", toNodeHandler(auth));
  app.use(express.json({ limit: "20mb" }));
  const extensionRelease = createExtensionReleaseHandlers(auth);
  // Stable URLs; each deploy replaces the file they serve.
  app.get("/extension/release", extensionRelease.releaseInfo);
  app.get("/extension/download", extensionRelease.download);
  app.post("/extension/pairing/start", account.pairingStart);
  app.post("/extension/pairing/exchange", account.pairingExchange);
  app.get("/me/activity", account.activity);
  app.get("/me/jobs/:jobId", account.jobDetail);
  app.post("/listings/apply-result", account.applyResult);
  app.get("/api/v1/verification-link", (req, res) => {
    const mailEnabled = mailDeliveryEnabled(env);
    const email = String(req.query.email ?? "");
    res.json({
      url: mailEnabled ? null : peekVerificationLink(email) ?? null,
      mailEnabled,
    });
  });
  app.use("/api/v1/admin", createAdminRouter(auth, env));
  await ensureAdminDataStores(env.MONGO_URL).catch((error: unknown) => {
    logger.warn({ err: error instanceof Error ? error.message : "store setup failed" }, "mongo stores");
  });
  if (env.ADMIN_BOOTSTRAP_EMAIL && env.ADMIN_BOOTSTRAP_PASSWORD) {
    await bootstrapAdminAccount({
      auth,
      mongoUrl: env.MONGO_URL,
      email: env.ADMIN_BOOTSTRAP_EMAIL,
      password: env.ADMIN_BOOTSTRAP_PASSWORD,
      logger,
    }).catch((error: unknown) => {
      logger.warn(
        { err: error instanceof Error ? error.message : "bootstrap failed" },
        "admin bootstrap",
      );
    });
  }
  app.post(
    "/listings/scrape",
    createScrapeListingHandler(env.SCRAPER_WORKER_URL, { mongoUrl: env.MONGO_URL, auth }),
  );
  const scrapeJobs = createScrapeJobsHandlers({ ...env, auth });
  app.post("/listings/scrape-jobs", scrapeJobs.createScrapeJob);
  app.get("/listings/scrape-jobs/:jobId", scrapeJobs.getScrapeJob);
} else {
  logger.warn("MONGO_URL is not set; website login and extension pairing are disabled");
  app.use(express.json({ limit: "20mb" }));
  app.all("/api/auth/{*path}", (_req, res) => {
    res.status(503).json({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE", message: "Set MONGO_URL to enable accounts" },
    });
  });
  app.post("/listings/scrape", createScrapeListingHandler(env.SCRAPER_WORKER_URL));
  const scrapeJobs = createScrapeJobsHandlers(env);
  app.post("/listings/scrape-jobs", scrapeJobs.createScrapeJob);
  app.get("/listings/scrape-jobs/:jobId", scrapeJobs.getScrapeJob);
}

app.get("/health", (req, res) => {
  const body: HealthResponse = { ok: true, service: "api" };
  withCorrelationId(logger, req.correlationId).info("health check");
  res.json(body);
});

app.post("/listings", createListing);
app.post("/listings/sell-similar", sellSimilar);
app.get("/listings/scrape/progress", createScrapeProgressHandler(env.SCRAPER_WORKER_URL));
app.post("/listings/scrape-cache/clear", clearScrapeCacheHandler);

const cacheBackend = await configureScrapeCache(env.REDIS_URL);

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, cacheBackend }, "api listening");
});
