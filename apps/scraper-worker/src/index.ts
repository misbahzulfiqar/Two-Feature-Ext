import { loadEnv, loadRootEnv } from "@sell-similar/config";
import {
  scrapeProgressPercent,
  type ScrapeListingJobPayload,
  type ScrapeProgressStage,
} from "@sell-similar/contracts";
import {
  completeScrapeJob,
  failScrapeJob,
  getMongoClient,
  getScrapeJobById,
  markScrapeJobProcessing,
  updateScrapeJobProgress,
} from "@sell-similar/ebay-models";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { scrapeListingJobPayloadSchema, scrapedListingDataSchema } from "@sell-similar/validation";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { scraperEnvSchema } from "./env.js";
import { connectRedis } from "./redis.js";
import { runScrape } from "./run-scrape.js";
import { startScrapeHttpServer } from "./scrape-http.js";

loadRootEnv();

const env = loadEnv(scraperEnvSchema);
const logger = createLogger({ name: "scraper-worker", level: env.LOG_LEVEL });

startScrapeHttpServer(env, logger);

async function persistProgress(jobId: string | undefined, stage: ScrapeProgressStage): Promise<void> {
  if (!env.MONGO_URL || !jobId) {
    return;
  }
  if (stage === "worker_start") {
    await markScrapeJobProcessing(env.MONGO_URL, jobId, stage);
    return;
  }
  await updateScrapeJobProgress(env.MONGO_URL, jobId, stage);
}

async function writeQueueAudit(
  jobId: string,
  event: "scrape_completed" | "scrape_failed",
): Promise<void> {
  if (!env.MONGO_URL) {
    return;
  }
  const job = await getScrapeJobById(env.MONGO_URL, jobId);
  const db = (await getMongoClient(env.MONGO_URL)).db();
  switch (event) {
    case "scrape_completed":
      await db.collection("auditEvents").insertOne({
        event,
        userId: job?.userId ?? undefined,
        jobId,
        listingId: job?.listingId ?? undefined,
        targetId: job?.listingId || jobId,
        metadata: {
          collection: "scrapedListings",
          listingId: job?.listingId,
          fitmentCount: job?.fitmentCount,
          imageCount: job?.imageCount,
          itemSpecificCount: job?.itemSpecificCount,
          warningCount: job?.warningCount,
        },
        createdAt: new Date(),
      });
      return;
    case "scrape_failed":
      await db.collection("auditEvents").insertOne({
        event,
        userId: job?.userId ?? undefined,
        jobId,
        targetId: jobId,
        details: job?.errorMessage || job?.error || "Scrape failed",
        metadata: { errorCode: job?.errorCode ?? "SCRAPE_FAILED" },
        createdAt: new Date(),
      });
      return;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function startScrapeListingWorker(connection: Redis): void {
  connection.on("error", (error) => {
    logger.warn({ err: error.message }, "Redis connection error");
  });
  const worker = new Worker<ScrapeListingJobPayload>(
    "scrape-listing",
    async (job) => {
      const payload = scrapeListingJobPayloadSchema.parse(job.data);
      const log = withCorrelationId(logger, payload.correlationId);
      const jobId = String(job.id ?? "");
      log.info(
        { jobId, listingUrl: payload.listingUrl, scrapeMode: payload.scrapeMode },
        "scrape-listing received",
      );

      const report = async (stage: ScrapeProgressStage): Promise<void> => {
        await job.updateProgress({
          stage,
          percent: scrapeProgressPercent(stage),
        });
        await persistProgress(jobId, stage);
      };

      await report("worker_start");
      const result = await runScrape(env, payload.listingUrl, {
        scrapeMode: payload.scrapeMode,
        onProgress: report,
      });

      if (result.status !== "ok") {
        const message = result.message || "eBay scrape failed";
        if (env.MONGO_URL && jobId) {
          await failScrapeJob(env.MONGO_URL, jobId, message);
        }
        throw new Error(message);
      }

      const listingData = scrapedListingDataSchema.safeParse(result.listingData);
      if (!listingData.success) {
        const message = "Scraper worker returned invalid listing data";
        if (env.MONGO_URL && jobId) {
          await failScrapeJob(env.MONGO_URL, jobId, message, "INVALID_SCRAPE_RESULT");
        }
        throw new Error(message);
      }

      await report("complete");
      if (env.MONGO_URL && jobId) {
        await completeScrapeJob(env.MONGO_URL, jobId, listingData.data);
        await writeQueueAudit(jobId, "scrape_completed");
      }
      log.info(
        {
          jobId,
          scrapeMode: payload.scrapeMode,
          compatibility: listingData.data.compatibilityCount,
        },
        "scrape-listing completed",
      );
      return listingData.data;
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "job failed");
    if (env.MONGO_URL && job?.id) {
      void failScrapeJob(
        env.MONGO_URL,
        String(job.id),
        error instanceof Error ? error.message : "eBay scrape job failed",
      ).then(() => writeQueueAudit(String(job.id), "scrape_failed"));
    }
  });

  logger.info("scraper-worker also listening for scrape-listing jobs");
}

if (env.REDIS_URL) {
  void connectRedis(env.REDIS_URL, () => {
    logger.warn("Redis is not running; HTTP scrape continues. BullMQ will start when Redis is available.");
  }).then((connection) => {
    startScrapeListingWorker(connection);
  });
} else {
  logger.info("REDIS_URL not set; HTTP scrape only");
}
