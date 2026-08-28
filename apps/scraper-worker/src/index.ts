import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { ScrapeListingJobPayload } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { scrapeListingJobPayloadSchema } from "@sell-similar/validation";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createBrowser } from "./browser.js";
import { scraperEnvSchema } from "./env.js";

loadRootEnv();

const env = loadEnv(scraperEnvSchema);
const logger = createLogger({ name: "scraper-worker", level: env.LOG_LEVEL });
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker<ScrapeListingJobPayload>(
  "scrape-listing",
  async (job) => {
    const payload = scrapeListingJobPayloadSchema.parse(job.data);
    const log = withCorrelationId(logger, payload.correlationId);
    log.info({ jobId: job.id, listingUrl: payload.listingUrl }, "scrape-listing received");

    const browser = await createBrowser(env);
    try {
      const page = await browser.newPage();
      await page.goto(payload.listingUrl, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      log.info({ title }, "scrape-listing completed");
      return { title };
    } finally {
      await browser.close();
    }
  },
  { connection },
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "job failed");
});

logger.info("scraper-worker listening for scrape-listing jobs");
