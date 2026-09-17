import type { CorrelationId, ScrapeMode } from "@sell-similar/contracts";
import {
  createQueuedScrapeJob,
  failScrapeJob,
  findReusableScrapeJob,
  getScrapeJobById,
} from "@sell-similar/ebay-models";
import { ebayItemIdFromListingUrl } from "@sell-similar/contracts";
import { SCRAPE_CACHE_TTL_MS } from "../scrape-cache.js";
import { createScrapeJobRequestSchema } from "@sell-similar/validation";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getScrapeListingQueue } from "../scrape-listing-queue.js";
import { getAdminSettings } from "../admin/settings.js";
import type { Auth } from "../auth.js";
import { persistQueuedJobCreated, resolveScrapeActor } from "../scrape-records.js";

function correlationId(req: Request): CorrelationId {
  return req.correlationId as CorrelationId;
}

export function createScrapeJobsHandlers(env: {
  REDIS_URL?: string;
  MONGO_URL?: string;
  auth?: Auth;
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
      const settings = await getAdminSettings(env.MONGO_URL);
      if (settings.maintenance.enabled) {
        return res.status(503).json({
          ok: false,
          error: {
            code: "MAINTENANCE",
            message: settings.maintenance.message || "The service is in maintenance mode",
          },
          correlationId: req.correlationId,
        });
      }
      if (scrapeMode === "full-scrape" && !settings.features.fullScrapeEnabled) {
        return res.status(403).json({
          ok: false,
          error: { code: "FEATURE_DISABLED", message: "Full scrape is disabled" },
          correlationId: req.correlationId,
        });
      }
      if (scrapeMode === "only-fitment" && !settings.features.fitmentOnlyEnabled) {
        return res.status(403).json({
          ok: false,
          error: { code: "FEATURE_DISABLED", message: "Fitment-only scrape is disabled" },
          correlationId: req.correlationId,
        });
      }

      if (!parsed.data.refresh) {
        const reusable = await findReusableScrapeJob(env.MONGO_URL, {
          ebayItemId: ebayItemIdFromListingUrl(parsed.data.listingUrl),
          scrapeMode,
          withinMs: SCRAPE_CACHE_TTL_MS,
        }).catch(() => null);
        if (reusable) {
          return res.status(200).json({
            ok: true,
            data: reusable,
            reused: true,
            correlationId: req.correlationId,
          });
        }
      }

      const jobId = randomUUID();

      try {
        const actor = env.MONGO_URL
          ? await resolveScrapeActor({
              mongoUrl: env.MONGO_URL,
              req,
              auth: env.auth,
            })
          : {};
        const record = await createQueuedScrapeJob(env.MONGO_URL, {
          jobId,
          listingUrl: parsed.data.listingUrl,
          scrapeMode,
          userId: actor.userId ?? null,
          marketplace: settings.marketplace,
        });
        await persistQueuedJobCreated({
          mongoUrl: env.MONGO_URL,
          req,
          auth: env.auth,
          jobId,
          listingUrl: parsed.data.listingUrl,
          scrapeMode,
          ebayItemId: record.ebayItemId,
        });

        const queue = getScrapeListingQueue(env.REDIS_URL);
        await queue.add(
          "scrape-listing",
          {
            listingUrl: parsed.data.listingUrl,
            scrapeMode,
            requestedBy: actor.userId,
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
