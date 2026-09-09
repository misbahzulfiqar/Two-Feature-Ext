import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { createAuth } from "./auth.js";
import { createListing, createScrapeListingHandler, sellSimilar } from "./controllers/ListingsController.js";
import { createScrapeJobsHandlers } from "./controllers/ScrapeJobsController.js";
import { correlationMiddleware } from "./correlation.js";
import { corsMiddleware } from "./cors.js";
import { apiEnvSchema } from "./env.js";

loadRootEnv();

const env = loadEnv(apiEnvSchema);
const logger = createLogger({ name: "api", level: env.LOG_LEVEL });
const auth = createAuth(env);

const app = express();
app.use(correlationMiddleware);
app.use(corsMiddleware);
app.all("/api/auth/{*path}", toNodeHandler(auth));
app.use(express.json({ limit: "20mb" }));

app.get("/health", (req, res) => {
  const body: HealthResponse = { ok: true, service: "api" };
  withCorrelationId(logger, req.correlationId).info("health check");
  res.json(body);
});

app.post("/listings", createListing);
app.post("/listings/sell-similar", sellSimilar);
app.post("/listings/scrape", createScrapeListingHandler(env.SCRAPER_WORKER_URL));

const scrapeJobs = createScrapeJobsHandlers(env);
app.post("/listings/scrape-jobs", scrapeJobs.createScrapeJob);
app.get("/listings/scrape-jobs/:jobId", scrapeJobs.getScrapeJob);

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "api listening");
});
