import type { Auth } from "../auth.js";
import type { ApiEnv } from "../env.js";
import { getScrapeListingQueue } from "../scrape-listing-queue.js";
import { Redis } from "ioredis";
import { createQueuedScrapeJob, listListingImagesForJob } from "@sell-similar/ebay-models";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { writeAuditEvent } from "./audit.js";
import { adminCollection, adminDb } from "./db.js";
import {
  canonicalEbayUrl,
  classifyJobError,
  dayKey,
  durationMs,
  formatDuration,
  isRetryableFailure,
  parseDateParam,
  parsePositiveInt,
  queryString,
  rangeDays,
  sanitizeAdminText,
  startOfRange,
} from "./helpers.js";
import { getAdminSettings, saveAdminSettings } from "./settings.js";
import {
  API_VERSION,
  CRON_JOBS_COLLECTION,
  EXTENSION_VERSION,
  SCRAPE_JOBS_COLLECTION,
  SCRAPER_VERSION,
  SESSIONS_COLLECTION,
  USERS_COLLECTION,
  WORKER_CONCURRENCY,
  type AuthUserDoc,
  type AdminSettingsDoc,
  type AuditEventDoc,
} from "./types.js";

type JobDoc = {
  jobId: string;
  ebayItemId: string;
  listingUrl: string;
  scrapeMode: "full-scrape" | "only-fitment" | string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  progress?: { stage?: string; percent?: number };
  compatibility?: unknown[];
  result?: {
    title?: string;
    sku?: string;
    price?: string;
    images?: string[];
    itemSpecifics?: Array<{ key?: string; value?: string }>;
    condition?: string;
    conditionDescription?: string;
    description?: string;
    category?: { id?: string; name?: string; path?: string[] };
    storeCategories?: Array<{ name?: string; id?: string; path?: string[] }>;
    shipping?: { service?: string; cost?: string; handlingTime?: string; location?: string; details?: string };
    weight?: { value?: string; unit?: string };
    dimensions?: { length?: string; width?: string; height?: string; unit?: string; raw?: string };
    compatibility?: unknown[];
    compatibilityCount?: number;
    fitment?: unknown[];
  } | null;
  imageIds?: string[];
  error?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  duration?: number | null;
  itemSpecificCount?: number;
  fitmentCount?: number;
  imageCount?: number;
  warningCount?: number;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  userId?: string;
  marketplace?: string;
};

type SessionDoc = {
  id: string;
  userId: string;
  token?: string;
  expiresAt: Date;
  updatedAt?: Date;
  createdAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const settingsPatchSchema = z.object({
  marketplace: z.string().min(2).max(8).optional(),
  progressRetentionDays: z.number().int().min(1).max(365).optional(),
  scraperConcurrency: z.number().int().min(1).max(16).optional(),
  jobTimeoutSeconds: z.number().int().min(30).max(600).optional(),
  retryAttempts: z.number().int().min(0).max(10).optional(),
  perUserJobRateLimit: z.number().int().min(0).max(10_000).optional(),
  ipRateLimit: z.number().int().min(0).max(10_000).optional(),
  concurrentJobsPerUser: z.number().int().min(1).max(20).optional(),
  features: z
    .object({
      fullScrapeEnabled: z.boolean().optional(),
      fitmentOnlyEnabled: z.boolean().optional(),
      registrationEnabled: z.boolean().optional(),
    })
    .optional(),
  maintenance: z
    .object({
      enabled: z.boolean().optional(),
      message: z.string().max(500).optional(),
    })
    .optional(),
  minimumSupportedExtension: z.string().max(32).optional(),
});

function actor(req: Request) {
  return req.adminActor ?? { id: "", email: "", name: "", role: "admin" as const };
}

function userStatus(user: AuthUserDoc): "active" | "disabled" {
  return user.banned ? "disabled" : "active";
}

function publicUser(user: AuthUserDoc, extras?: { jobs?: number; lastActive?: string | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
    status: userStatus(user),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString(),
    jobs: extras?.jobs ?? 0,
    lastActive: extras?.lastActive ?? null,
  };
}

function publicJob(job: JobDoc, user?: AuthUserDoc | null) {
  const duration = durationMs(job.startedAt ?? null, job.completedAt ?? null);
  return {
    jobId: job.jobId,
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    sourceItemId: job.ebayItemId,
    sourceUrl: canonicalEbayUrl(job.ebayItemId),
    mode: job.scrapeMode,
    status: job.status,
    durationMs: duration,
    duration: formatDuration(duration),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    error: job.error ? sanitizeAdminText(job.error) : null,
    progress: job.progress ?? null,
  };
}

async function lastActiveMap(mongoUrl: string, userIds: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (userIds.length === 0) {
    return map;
  }
  const sessions = await adminCollection<SessionDoc>(mongoUrl, SESSIONS_COLLECTION);
  const rows = await sessions
    .aggregate<{ _id: string; last: Date }>([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", last: { $max: "$updatedAt" } } },
    ])
    .toArray();
  for (const row of rows) {
    if (row.last) {
      map.set(row._id, row.last);
    }
  }
  return map;
}

async function usersByIds(mongoUrl: string, ids: string[]): Promise<Map<string, AuthUserDoc>> {
  const map = new Map<string, AuthUserDoc>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    return map;
  }
  const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
  const docs = await users.find({ id: { $in: unique } }).toArray();
  for (const doc of docs) {
    map.set(doc.id, doc);
  }
  return map;
}

export function createAdminHandlers(auth: Auth, env: ApiEnv) {
  const mongoUrl = env.MONGO_URL ?? "";

  async function audit(req: Request, event: string, details: string, extra?: { targetId?: string; metadata?: Record<string, unknown> }) {
    const adminUser = actor(req);
    await writeAuditEvent(mongoUrl, {
      event,
      userId: adminUser.id,
      userEmail: adminUser.email,
      targetId: extra?.targetId,
      details,
      metadata: extra?.metadata,
      correlationId: req.correlationId,
    });
  }

  return {
    dashboard: async function dashboard(req: Request, res: Response) {
      const days = rangeDays(req.query.range);
      const from = startOfRange(days);
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [totalUsers, activeUsers, todayJobs, rangeJobs, statusGroups, recent] = await Promise.all([
        users.countDocuments(),
        users.countDocuments({ banned: { $ne: true } }),
        jobs.countDocuments({ createdAt: { $gte: todayStart } }),
        jobs.find({ createdAt: { $gte: from } }).toArray(),
        jobs
          .aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
          .toArray(),
        jobs.find({}).sort({ createdAt: -1 }).limit(8).toArray(),
      ]);

      const statusCount = Object.fromEntries(statusGroups.map((row) => [row._id, row.count]));
      const activityMap = new Map<string, { date: string; completed: number; failed: number; queued: number }>();
      for (let i = 0; i < days; i += 1) {
        const day = new Date(from);
        day.setUTCDate(from.getUTCDate() + i);
        const key = dayKey(day);
        activityMap.set(key, { date: key, completed: 0, failed: 0, queued: 0 });
      }
      for (const job of rangeJobs) {
        const key = dayKey(job.createdAt);
        const bucket = activityMap.get(key);
        if (!bucket) {
          continue;
        }
        if (job.status === "completed") {
          bucket.completed += 1;
        } else if (job.status === "failed") {
          bucket.failed += 1;
        } else {
          bucket.queued += 1;
        }
      }

      const userMap = await usersByIds(
        mongoUrl,
        recent.map((job) => job.userId ?? ""),
      );

      res.json({
        ok: true,
        data: {
          users: { total: totalUsers, active: activeUsers },
          jobs: {
            today: todayJobs,
            total: statusGroups.reduce((sum, row) => sum + row.count, 0),
            completed: statusCount.completed ?? 0,
            failed: statusCount.failed ?? 0,
            queued: statusCount.queued ?? 0,
            processing: statusCount.processing ?? 0,
          },
          activity: [...activityMap.values()],
          recentJobs: recent.map((job) => publicJob(job, job.userId ? userMap.get(job.userId) : null)),
        },
      });
    },

    users: async function users(req: Request, res: Response) {
      const page = parsePositiveInt(req.query.page, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 25, 100);
      const search = queryString(req, "search").toLowerCase();
      const status = queryString(req, "status");
      const sort = queryString(req, "sort") || "latest";
      const collection = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const filter: Record<string, unknown> = {};
      if (status === "active") {
        filter.banned = { $ne: true };
      } else if (status === "disabled") {
        filter.banned = true;
      }
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ];
      }
      const sortSpec: Record<string, 1 | -1> =
        sort === "oldest" ? { createdAt: 1 } : sort === "recent" ? { updatedAt: -1 } : { createdAt: -1 };
      const total = await collection.countDocuments(filter);
      const items = await collection
        .find(filter)
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      const activeMap = await lastActiveMap(
        mongoUrl,
        items.map((item) => item.id),
      );
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const jobCounts = await jobs
        .aggregate<{ _id: string; count: number }>([
          { $match: { userId: { $in: items.map((item) => item.id) } } },
          { $group: { _id: "$userId", count: { $sum: 1 } } },
        ])
        .toArray();
      const jobMap = new Map(jobCounts.map((row) => [row._id, row.count]));
      let ordered = items.map((item) =>
        publicUser(item, {
          jobs: jobMap.get(item.id) ?? 0,
          lastActive: activeMap.get(item.id)?.toISOString() ?? null,
        }),
      );
      if (sort === "jobs") {
        ordered = ordered.sort((a, b) => b.jobs - a.jobs);
      }
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [allTotal, allActive, allDisabled, newThisMonth] = await Promise.all([
        collection.countDocuments(),
        collection.countDocuments({ banned: { $ne: true } }),
        collection.countDocuments({ banned: true }),
        collection.countDocuments({ createdAt: { $gte: monthStart } }),
      ]);
      res.json({
        ok: true,
        data: {
          items: ordered,
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          stats: {
            total: allTotal,
            active: allActive,
            disabled: allDisabled,
            newThisMonth,
          },
        },
      });
    },

    userDetail: async function userDetail(req: Request, res: Response) {
      const userId = String(req.params.userId ?? "");
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const user = await users.findOne({ id: userId });
      if (!user) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
        return;
      }
      const jobsCol = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const recentJobs = await jobsCol.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
      const [totalJobs, fullScrapes, fitmentOnly, completed] = await Promise.all([
        jobsCol.countDocuments({ userId }),
        jobsCol.countDocuments({ userId, scrapeMode: "full-scrape" }),
        jobsCol.countDocuments({ userId, scrapeMode: "only-fitment" }),
        jobsCol.countDocuments({ userId, status: "completed" }),
      ]);
      const activeMap = await lastActiveMap(mongoUrl, [userId]);
      const auditCol = await adminCollection<AuditEventDoc>(mongoUrl, "auditEvents");
      const activity = await auditCol.find({ userId }).sort({ createdAt: -1 }).limit(25).toArray();
      res.json({
        ok: true,
        data: {
          user: publicUser(user, {
            jobs: totalJobs,
            lastActive: activeMap.get(userId)?.toISOString() ?? null,
          }),
          statistics: {
            totalJobs,
            fullScrapes,
            fitmentOnly,
            successRate: totalJobs === 0 ? null : Math.round((completed / totalJobs) * 1000) / 10,
          },
          recentJobs: recentJobs.map((job) => publicJob(job, user)),
          activity: activity.map((event) => ({
            event: event.event,
            details: event.details,
            createdAt: event.createdAt.toISOString(),
          })),
        },
      });
    },

    patchUser: async function patchUser(req: Request, res: Response) {
      const userId = String(req.params.userId ?? "");
      const body = z
        .object({
          name: z.string().min(1).max(80).optional(),
          role: z.enum(["user", "admin"]).optional(),
        })
        .parse(req.body ?? {});
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const user = await users.findOne({ id: userId });
      if (!user) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
        return;
      }
      if (body.role && userId === actor(req).id && body.role !== "admin") {
        const admins = await users.countDocuments({ role: "admin", banned: { $ne: true } });
        if (admins <= 1) {
          res.status(400).json({
            ok: false,
            error: { code: "LAST_ADMIN", message: "You cannot remove the last administrator" },
          });
          return;
        }
      }
      const $set: Partial<AuthUserDoc> = {};
      if (body.name) {
        $set.name = body.name;
      }
      if (body.role) {
        $set.role = body.role;
      }
      if (Object.keys($set).length > 0) {
        await users.updateOne({ id: userId }, { $set });
      }
      await audit(req, "admin.user_updated", `Updated user ${user.email}`, {
        targetId: userId,
        metadata: { name: body.name, role: body.role },
      });
      const next = await users.findOne({ id: userId });
      res.json({ ok: true, data: { user: next ? publicUser(next) : null } });
    },

    patchUserStatus: async function patchUserStatus(req: Request, res: Response) {
      const userId = String(req.params.userId ?? "");
      const body = z.object({ status: z.enum(["active", "disabled"]) }).parse(req.body ?? {});
      if (userId === actor(req).id && body.status === "disabled") {
        res.status(400).json({
          ok: false,
          error: { code: "LAST_ADMIN", message: "You cannot disable your own administrator account" },
        });
        return;
      }
      const headers = fromNodeHeaders(req.headers);
      if (body.status === "disabled") {
        await auth.api.banUser({
          body: { userId, banReason: "Disabled by administrator" },
          headers,
        });
        await audit(req, "admin.user_disabled", `Disabled user ${userId}`, { targetId: userId });
      } else {
        await auth.api.unbanUser({ body: { userId }, headers });
        await audit(req, "admin.user_enabled", `Enabled user ${userId}`, { targetId: userId });
      }
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const user = await users.findOne({ id: userId });
      res.json({ ok: true, data: { user: user ? publicUser(user) : null } });
    },

    createUser: async function createUser(req: Request, res: Response) {
      const body = z
        .object({
          name: z.string().min(1).max(80),
          email: z.string().email(),
          password: z.string().min(8).max(128),
          role: z.enum(["user", "admin"]).default("user"),
        })
        .parse(req.body ?? {});
      const created = await auth.api.createUser({
        body: {
          name: body.name,
          email: body.email,
          password: body.password,
          role: body.role,
        },
        headers: fromNodeHeaders(req.headers),
      });
      await audit(req, "admin.user_created", `Created user ${body.email}`, {
        targetId: created.user.id,
        metadata: { role: body.role },
      });
      res.status(201).json({ ok: true, data: { user: created.user } });
    },

    resetPassword: async function resetPassword(req: Request, res: Response) {
      const userId = String(req.params.userId ?? "");
      const body = z.object({ newPassword: z.string().min(8).max(128).optional() }).parse(req.body ?? {});
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const user = await users.findOne({ id: userId });
      if (!user) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
        return;
      }
      if (body.newPassword) {
        await auth.api.setUserPassword({
          body: { userId, newPassword: body.newPassword },
          headers: fromNodeHeaders(req.headers),
        });
        await audit(req, "admin.user_password_reset", `Set a new password for ${user.email}`, { targetId: userId });
        res.json({ ok: true, data: { mode: "password_set" } });
        return;
      }
      await auth.api.requestPasswordReset({
        body: { email: user.email, redirectTo: `${env.WEB_APP_URL}/reset-password` },
      });
      await audit(req, "admin.user_password_reset", `Requested password reset for ${user.email}`, { targetId: userId });
      res.json({ ok: true, data: { mode: "reset_requested" } });
    },

    jobs: async function jobs(req: Request, res: Response) {
      const page = parsePositiveInt(req.query.page, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 25, 100);
      const search = queryString(req, "search");
      const mode = queryString(req, "mode");
      const status = queryString(req, "status");
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to);
      const collection = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const filter: Record<string, unknown> = {};
      if (mode === "full-scrape" || mode === "only-fitment") {
        filter.scrapeMode = mode;
      }
      if (status === "queued" || status === "processing" || status === "completed" || status === "failed") {
        filter.status = status;
      }
      if (from || to) {
        filter.createdAt = {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        };
      }
      if (search) {
        const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
        const matchedUsers = await users
          .find({ email: { $regex: search, $options: "i" } })
          .project({ id: 1 })
          .toArray();
        filter.$or = [
          { jobId: { $regex: search, $options: "i" } },
          { ebayItemId: { $regex: search, $options: "i" } },
          { userId: { $in: matchedUsers.map((user) => user.id) } },
        ];
      }
      const total = await collection.countDocuments(filter);
      const items = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      const userMap = await usersByIds(
        mongoUrl,
        items.map((item) => item.userId ?? ""),
      );
      res.json({
        ok: true,
        data: {
          items: items.map((job) => publicJob(job, job.userId ? userMap.get(job.userId) : null)),
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    },

    jobDetail: async function jobDetail(req: Request, res: Response) {
      const jobId = String(req.params.jobId ?? "");
      const collection = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const job = await collection.findOne({ jobId });
      if (!job) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Job not found" } });
        return;
      }
      const userMap = await usersByIds(mongoUrl, job.userId ? [job.userId] : []);
      const result = job.result;
      const listingImages = await listListingImagesForJob(mongoUrl, job.jobId);
      const imageUrls = listingImages.map((image) => image.url);
      const specifics = Array.isArray(result?.itemSpecifics) ? result.itemSpecifics.length : 0;
      const fitment = Array.isArray(result?.compatibility)
        ? result.compatibility.length
        : Array.isArray(job.compatibility)
          ? job.compatibility.length
          : result?.compatibilityCount ?? 0;
      const images = listingImages.length || job.imageCount || (Array.isArray(result?.images) ? result.images.length : 0);
      res.json({
        ok: true,
        data: {
          job: {
            ...publicJob(job, job.userId ? userMap.get(job.userId) : null),
            retryable: isRetryableFailure(job.status, job.error ?? null),
            listingUrl: job.listingUrl,
          },
          summary: {
            itemSpecifics: specifics,
            fitmentRecords: fitment,
            images,
            applyWarnings: job.warningCount ?? 0,
          },
          source: {
            title: result?.title ?? null,
            thumbnail: imageUrls[0] ?? result?.images?.[0] ?? null,
            itemId: job.ebayItemId,
            ebayUrl: canonicalEbayUrl(job.ebayItemId),
          },
        },
      });
    },

    jobResult: async function jobResult(req: Request, res: Response) {
      const jobId = String(req.params.jobId ?? "");
      const collection = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const job = await collection.findOne({ jobId });
      if (!job) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Job not found" } });
        return;
      }
      const result = job.result;
      const listingImages = await listListingImagesForJob(mongoUrl, job.jobId);
      res.json({
        ok: true,
        data: {
          listing: result
            ? {
                title: result.title ?? null,
                sku: result.sku ?? null,
                price: result.price ?? null,
                condition: result.condition ?? null,
                conditionDescription: result.conditionDescription ?? null,
                category: result.category ?? null,
                storeCategories: result.storeCategories ?? [],
                shipping: result.shipping ?? null,
                weight: result.weight ?? null,
                dimensions: result.dimensions ?? null,
                description: result.description ? sanitizeAdminText(result.description) : null,
              }
            : null,
          itemSpecifics: result?.itemSpecifics ?? [],
          fitment: result?.compatibility ?? result?.fitment ?? job.compatibility ?? [],
          images: listingImages.map((image) => ({
            imageId: image.imageId,
            ebayImageId: image.ebayImageId,
            url: image.url,
            position: image.position,
          })),
          warnings: job.error ? [sanitizeAdminText(job.error)] : [],
        },
      });
    },

    jobEvents: async function jobEvents(req: Request, res: Response) {
      const jobId = String(req.params.jobId ?? "");
      const collection = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const job = await collection.findOne({ jobId });
      if (!job) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Job not found" } });
        return;
      }
      const events = [
        { timestamp: job.createdAt.toISOString(), stage: "queued", progress: 5, message: "Job created", detail: "" },
      ];
      if (job.startedAt) {
        events.push({
          timestamp: job.startedAt.toISOString(),
          stage: job.progress?.stage ?? "worker_start",
          progress: job.progress?.percent ?? 12,
          message: "Worker started",
          detail: "",
        });
      }
      if (job.completedAt) {
        events.push({
          timestamp: job.completedAt.toISOString(),
          stage: job.status === "failed" ? "failed" : "complete",
          progress: job.status === "failed" ? job.progress?.percent ?? 0 : 100,
          message: job.status === "failed" ? sanitizeAdminText(job.error ?? "Job failed") : "Job completed",
          detail: "",
        });
      }
      res.json({ ok: true, data: { events } });
    },

    retryJob: async function retryJob(req: Request, res: Response) {
      const jobId = String(req.params.jobId ?? "");
      const collection = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const job = await collection.findOne({ jobId });
      if (!job) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Job not found" } });
        return;
      }
      if (!isRetryableFailure(job.status, job.error ?? null)) {
        res.status(400).json({
          ok: false,
          error: { code: "NOT_RETRYABLE", message: "This job cannot be retried" },
        });
        return;
      }
      if (!env.REDIS_URL || !env.MONGO_URL) {
        res.status(503).json({
          ok: false,
          error: { code: "QUEUE_UNAVAILABLE", message: "Retry requires Redis and MongoDB" },
        });
        return;
      }
      const settings = await getAdminSettings(mongoUrl);
      if (settings.maintenance.enabled) {
        res.status(503).json({
          ok: false,
          error: { code: "MAINTENANCE", message: settings.maintenance.message || "Maintenance mode is on" },
        });
        return;
      }
      const retryId = `${job.jobId}-retry`;
      const record = await createQueuedScrapeJob(env.MONGO_URL, {
        jobId: `${retryId}-${Date.now()}`,
        listingUrl: job.listingUrl,
        scrapeMode: job.scrapeMode === "only-fitment" ? "only-fitment" : "full-scrape",
        userId: job.userId ?? null,
        marketplace: job.marketplace,
      });
      const queue = getScrapeListingQueue(env.REDIS_URL);
      await queue.add(
        "scrape-listing",
        {
          listingUrl: job.listingUrl,
          scrapeMode: record.scrapeMode,
          correlationId: req.correlationId,
        },
        { jobId: record.jobId, attempts: settings.retryAttempts || 3 },
      );
      await audit(req, "admin.job_retried", `Retried job ${jobId}`, {
        targetId: record.jobId,
        metadata: { originalJobId: jobId },
      });
      res.json({ ok: true, data: { jobId: record.jobId } });
    },

    audit: async function auditLogs(req: Request, res: Response) {
      const page = parsePositiveInt(req.query.page, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 25, 100);
      const event = queryString(req, "event");
      const userId = queryString(req, "userId");
      const search = queryString(req, "search");
      const from = parseDateParam(req.query.from);
      const to = parseDateParam(req.query.to);
      const collection = await adminCollection<AuditEventDoc>(mongoUrl, "auditEvents");
      const filter: Record<string, unknown> = {};
      if (event) {
        filter.event = event;
      }
      if (userId) {
        filter.userId = userId;
      }
      if (from || to) {
        filter.createdAt = {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        };
      }
      if (search) {
        filter.$or = [
          { details: { $regex: search, $options: "i" } },
          { userEmail: { $regex: search, $options: "i" } },
          { event: { $regex: search, $options: "i" } },
        ];
      }
      const total = await collection.countDocuments(filter);
      const items = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      res.json({
        ok: true,
        data: {
          items: items.map((item) => ({
            event: item.event,
            user: item.userEmail ?? item.userId ?? "system",
            details: item.details,
            createdAt: item.createdAt.toISOString(),
            targetId: item.targetId ?? null,
          })),
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    },

    errorsSummary: async function errorsSummary(_req: Request, res: Response) {
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const failed = await jobs.find({ status: "failed", error: { $ne: null } }).toArray();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const grouped = new Map<string, { code: string; description: string; severity: string; count: number; last: Date }>();
      let critical = 0;
      let thisWeek = 0;
      for (const job of failed) {
        const classified = classifyJobError(job.error ?? "");
        const current = grouped.get(classified.code) ?? {
          code: classified.code,
          description: classified.description,
          severity: classified.severity,
          count: 0,
          last: job.completedAt ?? job.createdAt,
        };
        current.count += 1;
        const when = job.completedAt ?? job.createdAt;
        if (when > current.last) {
          current.last = when;
        }
        grouped.set(classified.code, current);
        if (classified.severity === "critical") {
          critical += 1;
        }
        if (when >= weekAgo) {
          thisWeek += 1;
        }
      }
      res.json({
        ok: true,
        data: {
          total: failed.length,
          uniqueTypes: grouped.size,
          critical,
          thisWeek,
          types: [...grouped.values()]
            .sort((a, b) => b.count - a.count)
            .map((row) => ({
              code: row.code,
              description: row.description,
              severity: row.severity,
              count: row.count,
              lastOccurrence: row.last.toISOString(),
            })),
        },
      });
    },

    errors: async function errors(req: Request, res: Response) {
      const page = parsePositiveInt(req.query.page, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 25, 100);
      const code = queryString(req, "code");
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const failed = await jobs.find({ status: "failed" }).sort({ createdAt: -1 }).toArray();
      const classified = failed.map((job) => {
        const info = classifyJobError(job.error ?? "Unknown error");
        return { job, info };
      });
      const filtered = code ? classified.filter((row) => row.info.code === code) : classified;
      const slice = filtered.slice((page - 1) * limit, page * limit);
      const userMap = await usersByIds(
        mongoUrl,
        slice.map((row) => row.job.userId ?? ""),
      );
      res.json({
        ok: true,
        data: {
          items: slice.map((row) => ({
            code: row.info.code,
            message: sanitizeAdminText(row.job.error ?? ""),
            stage: row.job.progress?.stage ?? "failed",
            jobId: row.job.jobId,
            user: row.job.userId ? userMap.get(row.job.userId)?.email ?? null : null,
            createdAt: (row.job.completedAt ?? row.job.createdAt).toISOString(),
          })),
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      });
    },

    errorDetail: async function errorDetail(req: Request, res: Response) {
      const code = String(req.params.code ?? "");
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const failed = await jobs.find({ status: "failed" }).sort({ createdAt: -1 }).toArray();
      const matched = failed.filter((job) => classifyJobError(job.error ?? "").code === code);
      if (matched.length === 0) {
        res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "No errors with that code" } });
        return;
      }
      const info = classifyJobError(matched[0]?.error ?? "");
      const userMap = await usersByIds(
        mongoUrl,
        matched.map((job) => job.userId ?? ""),
      );
      const first = matched[matched.length - 1];
      const last = matched[0];
      res.json({
        ok: true,
        data: {
          code: info.code,
          description: info.description,
          severity: info.severity,
          count: matched.length,
          firstOccurrence: (first?.createdAt ?? new Date()).toISOString(),
          lastOccurrence: (last?.completedAt ?? last?.createdAt ?? new Date()).toISOString(),
          affectedUsers: [...new Set(matched.map((job) => job.userId).filter(Boolean))].length,
          affectedJobs: matched.length,
          occurrences: matched.slice(0, 25).map((job) => ({
            timestamp: (job.completedAt ?? job.createdAt).toISOString(),
            jobId: job.jobId,
            user: job.userId ? userMap.get(job.userId)?.email ?? null : null,
            message: sanitizeAdminText(job.error ?? ""),
            stage: job.progress?.stage ?? "failed",
          })),
        },
      });
    },

    workers: async function workers(_req: Request, res: Response) {
      const settings = await getAdminSettings(mongoUrl);
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const [queued, processing, failed] = await Promise.all([
        jobs.countDocuments({ status: "queued" }),
        jobs.countDocuments({ status: "processing" }),
        jobs.countDocuments({ status: "failed" }),
      ]);
      const queueStats = {
        waiting: queued,
        active: processing,
        failed,
        delayed: 0,
        longestWaitMs: null as number | null,
        averageProcessingMs: null as number | null,
        oldestActiveMs: null as number | null,
        jobs: [] as Array<{ position: number; jobId: string; user: string | null; mode: string; waitingMs: number }>,
      };
      if (env.REDIS_URL) {
        try {
          const queue = getScrapeListingQueue(env.REDIS_URL);
          const counts = await queue.getJobCounts("wait", "active", "failed", "delayed");
          queueStats.waiting = counts.wait ?? queued;
          queueStats.active = counts.active ?? processing;
          queueStats.failed = counts.failed ?? failed;
          queueStats.delayed = counts.delayed ?? 0;
          const waitingJobs = await queue.getWaiting(0, 19);
          queueStats.jobs = waitingJobs.map((item, index) => ({
            position: index + 1,
            jobId: String(item.id ?? ""),
            user: null,
            mode: String((item.data as { scrapeMode?: string })?.scrapeMode ?? "full-scrape"),
            waitingMs: Date.now() - item.timestamp,
          }));
          if (waitingJobs[0]) {
            queueStats.longestWaitMs = Date.now() - waitingJobs[0].timestamp;
          }
          const activeJobs = await queue.getActive(0, 19);
          if (activeJobs[0]?.processedOn) {
            queueStats.oldestActiveMs = Date.now() - activeJobs[0].processedOn;
          }
          const completedSample = await jobs
            .find({ status: "completed", startedAt: { $ne: null }, completedAt: { $ne: null } })
            .sort({ completedAt: -1 })
            .limit(20)
            .toArray();
          const durations = completedSample
            .map((job) => durationMs(job.startedAt ?? null, job.completedAt ?? null))
            .filter((value): value is number => value != null);
          if (durations.length > 0) {
            queueStats.averageProcessingMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
          }
        } catch {
          // Redis queue inspection is optional; Mongo counts still return.
        }
      }
      const workerHealth = process.env.VERCEL
        ? { ok: true, latencyMs: 0 }
        : await pingJson(`${env.SCRAPER_WORKER_URL}/health`);
      const configured = settings.scraperConcurrency || WORKER_CONCURRENCY;
      const online = workerHealth.ok ? 1 : 0;
      const busy = Math.min(processing, configured);
      const workerCards = Array.from({ length: Math.max(configured, 1) }, (_, index) => {
        const isOnline = index < online || (online === 1 && index === 0);
        let status: "idle" | "busy" | "offline" = "offline";
        if (isOnline) {
          status = index < busy ? "busy" : "idle";
        }
        return {
          id: `worker-${index + 1}`,
          name: `Worker ${index + 1}`,
          status,
          currentJob: status === "busy" ? "processing" : null,
          runtimeMs: status === "busy" ? queueStats.oldestActiveMs : null,
          lastHeartbeat: isOnline ? new Date().toISOString() : null,
          version: SCRAPER_VERSION,
        };
      });
      res.json({
        ok: true,
        data: {
          configuredConcurrency: configured,
          workers: workerCards,
          queue: queueStats,
          stats: {
            activeWorkers: online,
            queuedJobs: queueStats.waiting,
            processing: queueStats.active,
            failedJobs: queueStats.failed,
          },
        },
      });
    },

    health: async function health(_req: Request, res: Response) {
      const started = Date.now();
      const mongo = await pingMongo(mongoUrl);
      const redis = env.REDIS_URL
        ? await pingRedis(env.REDIS_URL)
        : { status: "offline", latencyMs: null, detail: "REDIS_URL not set" };
      const worker = process.env.VERCEL
        ? { ok: true, latencyMs: 0 }
        : await pingJson(`${env.SCRAPER_WORKER_URL}/health`);
      const cron = await pingCron(mongoUrl);
      const checks = {
        api: { status: "online", latencyMs: Date.now() - started, uptimeSeconds: Math.floor(process.uptime()), version: API_VERSION },
        mongo: mongo,
        redis,
        scraperWorkers: {
          status: worker.ok ? "online" : "offline",
          latencyMs: worker.latencyMs,
          detail: process.env.VERCEL
            ? "Scraper runs inside the API"
            : worker.ok
              ? "1 reachable worker process"
              : "Worker HTTP health failed",
        },
        agenda: cron,
        extensionApi: { status: "online", latencyMs: Date.now() - started, detail: "Admin API is reachable" },
        storage: mongo,
      };
      res.json({ ok: true, data: { checks, checkedAt: new Date().toISOString() } });
    },

    settings: async function settings(_req: Request, res: Response) {
      const value = await getAdminSettings(mongoUrl);
      res.json({ ok: true, data: value });
    },

    patchSettings: async function patchSettings(req: Request, res: Response) {
      const patch = settingsPatchSchema.parse(req.body ?? {});
      const current = await getAdminSettings(mongoUrl);
      const next: AdminSettingsDoc = {
        ...current,
        ...patch,
        features: { ...current.features, ...patch.features },
        maintenance: { ...current.maintenance, ...patch.maintenance },
        updatedAt: new Date(),
      };
      const saved = await saveAdminSettings(mongoUrl, next);
      const event =
        current.maintenance.enabled !== saved.maintenance.enabled
          ? saved.maintenance.enabled
            ? "admin.maintenance_enabled"
            : "admin.maintenance_disabled"
          : "admin.settings_changed";
      await audit(req, event, "Updated system settings", {
        metadata: {
          keys: Object.keys(patch),
        },
      });
      res.json({ ok: true, data: saved });
    },

    extensions: async function extensions(_req: Request, res: Response) {
      const settings = await getAdminSettings(mongoUrl);
      const jobs = await adminCollection<JobDoc & { extensionVersion?: string }>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const grouped = await jobs
        .aggregate<{ _id: string | null; count: number }>([
          { $group: { _id: "$extensionVersion", count: { $sum: 1 } } },
        ])
        .toArray();
      const known = grouped.filter((row) => typeof row._id === "string" && row._id);
      const totalKnown = known.reduce((sum, row) => sum + row.count, 0);
      res.json({
        ok: true,
        data: {
          currentExtension: EXTENSION_VERSION,
          minimumSupported: settings.minimumSupportedExtension,
          apiVersion: API_VERSION,
          scraperVersion: SCRAPER_VERSION,
          selectorProfile: null,
          distribution: known.map((row) => ({
            version: String(row._id),
            users: row.count,
            percent: totalKnown === 0 ? 0 : Math.round((row.count / totalKnown) * 1000) / 10,
          })),
          outdatedUsers: 0,
        },
      });
    },

    patchMinimumExtension: async function patchMinimumExtension(req: Request, res: Response) {
      const body = z.object({ minimumSupported: z.string().min(1).max(32) }).parse(req.body ?? {});
      const current = await getAdminSettings(mongoUrl);
      const saved = await saveAdminSettings(mongoUrl, {
        ...current,
        minimumSupportedExtension: body.minimumSupported,
        updatedAt: new Date(),
      });
      await audit(req, "admin.minimum_extension_changed", `Minimum extension set to ${body.minimumSupported}`, {
        metadata: { from: current.minimumSupportedExtension, to: body.minimumSupported },
      });
      res.json({ ok: true, data: { minimumSupported: saved.minimumSupportedExtension } });
    },

    search: async function search(req: Request, res: Response) {
      const q = queryString(req, "q");
      if (q.length < 2) {
        res.json({ ok: true, data: { users: [], jobs: [] } });
        return;
      }
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const [userHits, jobHits] = await Promise.all([
        users
          .find({
            $or: [{ email: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }],
          })
          .limit(5)
          .toArray(),
        jobs
          .find({
            $or: [{ jobId: { $regex: q, $options: "i" } }, { ebayItemId: { $regex: q, $options: "i" } }],
          })
          .limit(5)
          .toArray(),
      ]);
      res.json({
        ok: true,
        data: {
          users: userHits.map((user) => ({ id: user.id, name: user.name, email: user.email })),
          jobs: jobHits.map((job) => ({ jobId: job.jobId, sourceItemId: job.ebayItemId, status: job.status })),
        },
      });
    },

    profile: async function profile(req: Request, res: Response) {
      const adminUser = actor(req);
      const users = await adminCollection<AuthUserDoc>(mongoUrl, USERS_COLLECTION);
      const user = await users.findOne({ id: adminUser.id });
      const sessions = await adminCollection<SessionDoc>(mongoUrl, SESSIONS_COLLECTION);
      const sessionDocs = await sessions.find({ userId: adminUser.id }).sort({ updatedAt: -1 }).limit(10).toArray();
      const auditCol = await adminCollection<AuditEventDoc>(mongoUrl, "auditEvents");
      const activity = await auditCol.find({ userId: adminUser.id }).sort({ createdAt: -1 }).limit(20).toArray();
      const last = sessionDocs[0];
      res.json({
        ok: true,
        data: {
          user: {
            id: adminUser.id,
            name: user?.name ?? adminUser.name,
            email: user?.email ?? adminUser.email,
            role: "admin",
            lastLogin: last?.updatedAt?.toISOString() ?? last?.createdAt?.toISOString() ?? null,
          },
          sessions: sessionDocs.map((session) => ({
            id: session.id,
            updatedAt: (session.updatedAt ?? session.createdAt ?? new Date()).toISOString(),
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
            current: false,
          })),
          activity: activity.map((event) => ({
            event: event.event,
            details: event.details,
            createdAt: event.createdAt.toISOString(),
          })),
        },
      });
    },

    patchProfile: async function patchProfile(req: Request, res: Response) {
      const body = z.object({ name: z.string().min(1).max(80) }).parse(req.body ?? {});
      await auth.api.updateUser({
        body: { name: body.name },
        headers: fromNodeHeaders(req.headers),
      });
      await audit(req, "admin.profile_updated", "Updated admin profile", { metadata: { name: body.name } });
      res.json({ ok: true, data: { name: body.name } });
    },

    notifications: async function notifications(_req: Request, res: Response) {
      const jobs = await adminCollection<JobDoc>(mongoUrl, SCRAPE_JOBS_COLLECTION);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentFailed = await jobs.find({ status: "failed", createdAt: { $gte: hourAgo } }).toArray();
      const queued = await jobs.countDocuments({ status: "queued" });
      const items: Array<{ id: string; title: string; detail: string; createdAt: string; tone: "critical" | "warning" }> = [];
      if (recentFailed.length > 0) {
        items.push({
          id: "failed-jobs",
          title: `${recentFailed.length} job failure${recentFailed.length === 1 ? "" : "s"} in the last hour`,
          detail: sanitizeAdminText(recentFailed[0]?.error ?? "Scrape failed"),
          createdAt: (recentFailed[0]?.completedAt ?? recentFailed[0]?.createdAt ?? new Date()).toISOString(),
          tone: "critical",
        });
      }
      if (queued >= 20) {
        items.push({
          id: "queue-backlog",
          title: "Queue backlog",
          detail: `${queued} jobs are waiting`,
          createdAt: new Date().toISOString(),
          tone: "warning",
        });
      }
      const layout = recentFailed.filter((job) => classifyJobError(job.error ?? "").code === "EBAY_LAYOUT_CHANGED");
      if (layout.length >= 3) {
        items.push({
          id: "layout-changed",
          title: "Repeated EBAY_LAYOUT_CHANGED failures",
          detail: `${layout.length} recent layout mismatches`,
          createdAt: new Date().toISOString(),
          tone: "critical",
        });
      }
      res.json({ ok: true, data: { items } });
    },
  };
}

async function pingJson(url: string): Promise<{ ok: boolean; latencyMs: number | null }> {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { ok: response.ok, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

async function pingMongo(mongoUrl: string): Promise<{ status: string; latencyMs: number | null; detail: string }> {
  const started = Date.now();
  try {
    const db = await adminDb(mongoUrl);
    await db.command({ ping: 1 });
    return { status: "connected", latencyMs: Date.now() - started, detail: "Ping succeeded" };
  } catch {
    return { status: "offline", latencyMs: null, detail: "Ping failed" };
  }
}

async function pingRedis(redisUrl: string): Promise<{ status: string; latencyMs: number | null; detail: string }> {
  const started = Date.now();
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
  try {
    await redis.connect();
    await redis.ping();
    return { status: "connected", latencyMs: Date.now() - started, detail: "Ping succeeded" };
  } catch {
    return { status: "offline", latencyMs: null, detail: "Ping failed" };
  } finally {
    redis.disconnect();
  }
}

async function pingCron(mongoUrl: string): Promise<{ status: string; latencyMs: number | null; detail: string }> {
  const started = Date.now();
  try {
    const db = await adminDb(mongoUrl);
    const doc = await db.collection(CRON_JOBS_COLLECTION).findOne({}, { sort: { lastFinishedAt: -1 } });
    if (!doc) {
      return { status: "degraded", latencyMs: Date.now() - started, detail: "No Agenda jobs recorded" };
    }
    const last = (doc.lastFinishedAt ?? doc.lastRunAt ?? doc.lastModified) as Date | undefined;
    return {
      status: "connected",
      latencyMs: Date.now() - started,
      detail: last instanceof Date ? `Last run ${last.toISOString()}` : "Agenda collection present",
    };
  } catch {
    return { status: "offline", latencyMs: null, detail: "Could not read Agenda collection" };
  }
}
