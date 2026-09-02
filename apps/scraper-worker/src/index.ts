import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { ScrapeListingJobPayload } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { scrapeListingJobPayloadSchema } from "@sell-similar/validation";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { scraperEnvSchema } from "./env.js";
import { runScrape } from "./run-scrape.js";
import { startScrapeHttpServer } from "./scrape-http.js";

loadRootEnv();

const env = loadEnv(scraperEnvSchema);
const logger = createLogger({ name: "scraper-worker", level: env.LOG_LEVEL });

startScrapeHttpServer(env, logger);

if (env.REDIS_URL) {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<ScrapeListingJobPayload>(
    "scrape-listing",
    async (job) => {
      const payload = scrapeListingJobPayloadSchema.parse(job.data);
      const log = withCorrelationId(logger, payload.correlationId);
      log.info({ jobId: job.id, listingUrl: payload.listingUrl }, "scrape-listing received");
      const result = await runScrape(env, payload.listingUrl);
      log.info({ result }, "scrape-listing completed");
      return result;
    },
    { connection },
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "job failed");
  });

  logger.info("scraper-worker also listening for scrape-listing jobs");
} else {
  logger.info("REDIS_URL not set; HTTP scrape only");
}
