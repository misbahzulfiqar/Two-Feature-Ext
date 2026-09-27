import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import express from "express";
import morgan from "morgan";
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
  ? await import("./scrape-bridge.js")
      .then((bridge) => ({
        scrapeInProcess: bridge.scrapeListingInProcess,
        readProgress: bridge.readInProcessScrapeProgress,
      }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "scraper import failed";
        logger.warn({ err: message }, "in-process scraper unavailable");
        return {};
      })
  : {};

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
