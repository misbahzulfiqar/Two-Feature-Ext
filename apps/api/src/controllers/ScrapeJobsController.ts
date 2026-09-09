import type { CorrelationId, ScrapeMode } from "@sell-similar/contracts";
import {
  createQueuedScrapeJob,
  failScrapeJob,
  getScrapeJobById,
} from "@sell-similar/ebay-models";
import { createScrapeJobRequestSchema } from "@sell-similar/validation";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getScrapeListingQueue } from "../scrape-listing-queue.js";

function correlationId(req: Request): CorrelationId {
  return req.correlationId as CorrelationId;
}

export function createScrapeJobsHandlers(env: {
  REDIS_URL?: string;
  MONGO_URL?: string;
}) {
  return {
    createScrapeJob: async function createScrapeJob(req: Request, res: Response) {
      if (!env.REDIS_URL || !env.MONGO_URL) {
        return res.status(503).json({
          ok: false,
          error: {
            code: "ASYNC_SCRAPE_UNAVAILABLE",
            message: "Background eBay scraping requires REDIS_URL and MONGO_URL",
          },
          correlationId: req.correlationId,
        });
      }

      const parsed = createScrapeJobRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: parsed.error.message },
          correlationId: req.correlationId,
        });
      }

      const scrapeMode: ScrapeMode = parsed.data.scrapeMode ?? "full-scrape";
      const jobId = randomUUID();

      try {
        const record = await createQueuedScrapeJob(env.MONGO_URL, {
          jobId,
          listingUrl: parsed.data.listingUrl,
          scrapeMode,
        });

        const queue = getScrapeListingQueue(env.REDIS_URL);
        await queue.add(
          "scrape-listing",
          {
            listingUrl: parsed.data.listingUrl,
            scrapeMode,
            correlationId: correlationId(req),
          },
          {
            jobId,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: false,
            removeOnFail: false,
          },
        );

        return res.status(202).json({
          ok: true,
          data: record,
          correlationId: req.correlationId,
        });
      } catch (error) {
        await failScrapeJob(
          env.MONGO_URL,
          jobId,
          error instanceof Error ? error.message : "Could not enqueue eBay scrape job",
        ).catch(() => undefined);
        return res.status(502).json({
          ok: false,
          error: {
            code: "SCRAPE_JOB_ENQUEUE_FAILED",
            message:
              error instanceof Error ? error.message : "Could not enqueue eBay scrape job",
          },
          correlationId: req.correlationId,
        });
      }
    },

    getScrapeJob: async function getScrapeJob(req: Request, res: Response) {
      if (!env.MONGO_URL) {
        return res.status(503).json({
          ok: false,
          error: {
            code: "ASYNC_SCRAPE_UNAVAILABLE",
            message: "Background eBay scrape history requires MONGO_URL",
          },
          correlationId: req.correlationId,
        });
      }

      const jobId = String(req.params.jobId ?? "").trim();
      if (!jobId) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "jobId is required" },
          correlationId: req.correlationId,
        });
      }

      const record = await getScrapeJobById(env.MONGO_URL, jobId);
      if (!record) {
        return res.status(404).json({
          ok: false,
          error: { code: "SCRAPE_JOB_NOT_FOUND", message: "eBay scrape job not found" },
          correlationId: req.correlationId,
        });
      }

      return res.status(200).json({
        ok: true,
        data: record,
        correlationId: req.correlationId,
      });
    },
  };
}
