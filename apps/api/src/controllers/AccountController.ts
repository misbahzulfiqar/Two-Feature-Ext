import { countScrapeJobsForUser, getScrapeJobById, listScrapeJobsForUser } from "@sell-similar/ebay-models";
import type { Auth } from "../auth.js";
import { exchangePairingToken, issuePairingToken } from "../extension-pairing.js";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { formatDuration } from "../admin/helpers.js";
import { activityModeLabel, activityStatusLabel, persistApplyResult } from "../scrape-records.js";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function createAccountHandlers(auth: Auth, mongoUrl?: string) {
  return {
    pairingStart: async function pairingStart(req: Request, res: Response) {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        return res.status(401).json({
          ok: false,
          error: { code: "UNAUTHENTICATED", message: "Sign in to pair the extension" },
        });
      }
      if ("banned" in session.user && session.user.banned) {
        return res.status(403).json({
          ok: false,
          error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled" },
        });
      }
      const issued = issuePairingToken({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? "",
      });
      return res.status(200).json({ ok: true, data: issued });
    },

    pairingExchange: async function pairingExchange(req: Request, res: Response) {
      const token = String(
        req.body && typeof req.body === "object" && "token" in req.body
          ? req.body.token
          : "",
      ).trim();
      if (!token) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Pairing token is required" },
        });
      }
      const record = exchangePairingToken(token);
      if (!record) {
        return res.status(400).json({
          ok: false,
          error: {
            code: "PAIRING_INVALID",
            message: "Pairing token is invalid, used, or expired",
          },
        });
      }
      return res.status(200).json({
        ok: true,
        data: {
          userId: record.userId,
          email: record.email,
          name: record.name,
        },
      });
    },

    activity: async function activity(req: Request, res: Response) {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        return res.status(401).json({
          ok: false,
          error: { code: "UNAUTHENTICATED", message: "Sign in required" },
        });
      }
      if ("banned" in session.user && session.user.banned) {
        return res.status(403).json({
          ok: false,
          error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled" },
        });
      }
      if (!mongoUrl) {
        return res.status(200).json({
          ok: true,
          data: {
            listingsToday: 0,
            totalListings: 0,
            hoursSaved: 0,
            successRate: null,
            jobs: [],
          },
        });
      }
      const jobs = await listScrapeJobsForUser(mongoUrl, session.user.id, 50);
      const today = startOfUtcDay(new Date());
      const [listingsToday, totalListings, completedCount, failedCount] = await Promise.all([
        countScrapeJobsForUser(mongoUrl, session.user.id, { createdAtGte: today }),
        countScrapeJobsForUser(mongoUrl, session.user.id),
        countScrapeJobsForUser(mongoUrl, session.user.id, { status: "completed" }),
        countScrapeJobsForUser(mongoUrl, session.user.id, { status: "failed" }),
      ]);
      const finished = completedCount + failedCount;
      const durationMs = jobs
        .filter((job) => job.status === "completed")
        .reduce((sum, job) => sum + (job.duration ?? 0), 0);
      const successRate = finished === 0 ? null : Math.round((completedCount / finished) * 100);
      return res.status(200).json({
        ok: true,
        data: {
          listingsToday,
          totalListings,
          hoursSaved: Number((durationMs / 3_600_000).toFixed(1)),
          successRate,
          jobs: jobs.map((job) => ({
            jobId: job.jobId,
            itemId: job.ebayItemId || job.listingUrl,
            mode: activityModeLabel(job.scrapeMode),
            status: activityStatusLabel(job.status),
            progress: `${job.progress.percent}%`,
            fitment: String(job.fitmentCount ?? 0),
            images: String(job.imageCount ?? 0),
            duration: formatDuration(job.duration ?? null),
            date: job.createdAt,
          })),
        },
      });
    },

    jobDetail: async function jobDetail(req: Request, res: Response) {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        return res.status(401).json({
          ok: false,
          error: { code: "UNAUTHENTICATED", message: "Sign in required" },
        });
      }
      if (!mongoUrl) {
        return res.status(503).json({
          ok: false,
          error: { code: "UNAVAILABLE", message: "Job history requires MongoDB" },
        });
      }
      const jobId = String(req.params.jobId ?? "").trim();
      const job = await getScrapeJobById(mongoUrl, jobId);
      if (!job || job.userId !== session.user.id) {
        return res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        });
      }
      return res.status(200).json({
        ok: true,
        data: {
          jobId: job.jobId,
          itemId: job.ebayItemId,
          listingUrl: job.listingUrl,
          mode: activityModeLabel(job.scrapeMode),
          status: activityStatusLabel(job.status),
          marketplace: job.marketplace ?? "US",
          duration: formatDuration(job.duration ?? null),
          itemSpecificCount: job.itemSpecificCount ?? 0,
          fitmentCount: job.fitmentCount ?? 0,
          imageCount: job.imageCount ?? 0,
          warningCount: job.warningCount ?? 0,
          errorCode: job.errorCode,
          errorMessage: job.errorMessage ?? job.error,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          result: job.result,
        },
      });
    },

    applyResult: async function applyResult(req: Request, res: Response) {
      if (!mongoUrl) {
        return res.status(503).json({
          ok: false,
          error: { code: "UNAVAILABLE", message: "Apply history requires MongoDB" },
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const jobId = String("jobId" in body ? body.jobId : "").trim();
      const warningCount = Number("warningCount" in body ? body.warningCount : 0);
      if (!jobId) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "jobId is required" },
        });
      }
      const recorded = await persistApplyResult({
        mongoUrl,
        req,
        auth,
        jobId,
        fitmentCount:
          "fitmentCount" in body && Number.isFinite(Number(body.fitmentCount))
            ? Number(body.fitmentCount)
            : undefined,
        imageCount:
          "imageCount" in body && Number.isFinite(Number(body.imageCount))
            ? Number(body.imageCount)
            : undefined,
        warningCount: Number.isFinite(warningCount) ? warningCount : 0,
        warnings: Array.isArray((body as { warnings?: unknown }).warnings)
          ? ((body as { warnings: unknown[] }).warnings.filter((item) => typeof item === "string") as string[])
          : [],
      });
      if (!recorded) {
        return res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        });
      }
      return res.status(200).json({ ok: true, data: { jobId } });
    },
  };
}
