import type { ScrapeMode, ScrapedListingData } from "@sell-similar/contracts";
import { applyScrapeJobResult, recordFinishedScrapeJob } from "@sell-similar/ebay-models";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import type { Auth } from "./auth.js";
import { writeAuditEvent } from "./admin/audit.js";
import { adminCollection } from "./admin/db.js";
import { getAdminSettings } from "./admin/settings.js";
import {
  USER_SETTINGS_COLLECTION,
  USERS_COLLECTION,
  type AuthUserDoc,
  type UserSettingsDoc,
} from "./admin/types.js";

const SCRAPE_AUDIT_EVENTS = [
  "job_created",
  "scrape_completed",
  "scrape_failed",
  "result_applied",
  "apply_warning",
] as const;

type ScrapeAuditEvent = (typeof SCRAPE_AUDIT_EVENTS)[number];

export type ScrapeActor = {
  userId?: string;
  userEmail?: string;
};

export async function resolveScrapeActor(input: {
  mongoUrl: string;
  req: Request;
  auth?: Auth;
}): Promise<ScrapeActor> {
  if (input.auth) {
    const session = await input.auth.api.getSession({
      headers: fromNodeHeaders(input.req.headers),
    });
    if (session?.user?.id) {
      return { userId: session.user.id, userEmail: session.user.email };
    }
  }
  const claimedId = String(input.req.headers["x-extension-user-id"] ?? "").trim();
  if (!claimedId) {
    return {};
  }
  const users = await adminCollection<AuthUserDoc>(input.mongoUrl, USERS_COLLECTION);
  const user = await users.findOne({ id: claimedId });
  if (!user) {
    return {};
  }
  return { userId: user.id, userEmail: user.email };
}

async function rememberUserScrapePreference(
  mongoUrl: string,
  userId: string,
  scrapeMode: ScrapeMode,
): Promise<void> {
  const collection = await adminCollection<UserSettingsDoc>(mongoUrl, USER_SETTINGS_COLLECTION);
  await collection.updateOne(
    { userId },
    {
      $set: {
        userId,
        preferences: { defaultScrapeMode: scrapeMode },
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function writeScrapeAudit(input: {
  mongoUrl: string;
  event: ScrapeAuditEvent;
  actor: ScrapeActor;
  jobId: string;
  listingId?: string | null;
  details: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}): Promise<void> {
  await writeAuditEvent(input.mongoUrl, {
    event: input.event,
    userId: input.actor.userId,
    userEmail: input.actor.userEmail,
    jobId: input.jobId,
    listingId: input.listingId ?? undefined,
    targetId: input.listingId || input.jobId,
    details: input.details,
    metadata: input.metadata,
    correlationId: input.correlationId,
  });
}

export async function persistHttpScrape(input: {
  mongoUrl?: string;
  auth?: Auth;
  req: Request;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  startedAt: Date;
  status: "completed" | "failed";
  result?: ScrapedListingData | null;
  errorCode?: string;
  errorMessage?: string;
}): Promise<string | undefined> {
  if (!input.mongoUrl) {
    return undefined;
  }
  try {
    const actor = await resolveScrapeActor({
      mongoUrl: input.mongoUrl,
      req: input.req,
      auth: input.auth,
    });
    const settings = await getAdminSettings(input.mongoUrl);
    const record = await recordFinishedScrapeJob(input.mongoUrl, {
      jobId: randomUUID(),
      listingUrl: input.listingUrl,
      scrapeMode: input.scrapeMode,
      userId: actor.userId ?? null,
      marketplace: settings.marketplace,
      status: input.status,
      result: input.result,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      startedAt: input.startedAt,
    });
    if (actor.userId) {
      await rememberUserScrapePreference(input.mongoUrl, actor.userId, input.scrapeMode).catch(
        () => undefined,
      );
    }
    await writeScrapeAudit({
      mongoUrl: input.mongoUrl,
      event: "job_created",
      actor,
      jobId: record.jobId,
      listingId: record.listingId,
      details: `Scrape job created for ${record.ebayItemId || record.listingUrl}`,
      metadata: { scrapeMode: input.scrapeMode, status: "created" },
      correlationId: input.req.correlationId,
    }).catch(() => undefined);
    if (input.status === "completed") {
      await writeScrapeAudit({
        mongoUrl: input.mongoUrl,
        event: "scrape_completed",
        actor,
        jobId: record.jobId,
        listingId: record.listingId,
        details: "Scrape completed",
        metadata: {
          collection: "scrapedListings",
          listingId: record.listingId,
          fitmentCount: record.fitmentCount,
          imageCount: record.imageCount,
          itemSpecificCount: record.itemSpecificCount,
          warningCount: record.warningCount,
        },
        correlationId: input.req.correlationId,
      }).catch(() => undefined);
    } else {
      await writeScrapeAudit({
        mongoUrl: input.mongoUrl,
        event: "scrape_failed",
        actor,
        jobId: record.jobId,
        details: input.errorMessage || "Scrape failed",
        metadata: { errorCode: input.errorCode ?? "SCRAPE_FAILED" },
        correlationId: input.req.correlationId,
      }).catch(() => undefined);
    }
    return record.jobId;
  } catch {
    return undefined;
  }
}

export async function persistQueuedJobCreated(input: {
  mongoUrl: string;
  req: Request;
  auth?: Auth;
  jobId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  ebayItemId?: string;
}): Promise<ScrapeActor> {
  const actor = await resolveScrapeActor({
    mongoUrl: input.mongoUrl,
    req: input.req,
    auth: input.auth,
  });
  if (actor.userId) {
    await rememberUserScrapePreference(input.mongoUrl, actor.userId, input.scrapeMode);
  }
  await writeScrapeAudit({
    mongoUrl: input.mongoUrl,
    event: "job_created",
    actor,
    jobId: input.jobId,
    details: `Scrape job created for ${input.ebayItemId || input.listingUrl}`,
    metadata: { scrapeMode: input.scrapeMode },
    correlationId: input.req.correlationId,
  });
  return actor;
}

export async function persistApplyResult(input: {
  mongoUrl: string;
  req: Request;
  auth?: Auth;
  jobId: string;
  fitmentCount?: number;
  imageCount?: number;
  warningCount: number;
  warnings?: string[];
}): Promise<boolean> {
  const job = await applyScrapeJobResult(input.mongoUrl, input.jobId, {
    fitmentCount: input.fitmentCount,
    imageCount: input.imageCount,
    warningCount: input.warningCount,
  });
  if (!job) {
    return false;
  }
  const actor = await resolveScrapeActor({
    mongoUrl: input.mongoUrl,
    req: input.req,
    auth: input.auth,
  });
  await writeScrapeAudit({
    mongoUrl: input.mongoUrl,
    event: "result_applied",
    actor,
    jobId: input.jobId,
    listingId: job.listingId,
    details: "Listing result applied",
    metadata: {
      fitmentCount: input.fitmentCount ?? job.fitmentCount,
      imageCount: input.imageCount ?? job.imageCount,
      warningCount: input.warningCount,
    },
    correlationId: input.req.correlationId,
  });
  if (input.warningCount > 0) {
    await writeScrapeAudit({
      mongoUrl: input.mongoUrl,
      event: "apply_warning",
      actor,
      jobId: input.jobId,
      listingId: job.listingId,
      details: input.warnings?.join("; ") || `${input.warningCount} apply warning(s)`,
      metadata: { warningCount: input.warningCount, warnings: input.warnings ?? [] },
      correlationId: input.req.correlationId,
    });
  }
  return true;
}

export function activityModeLabel(scrapeMode: string): string {
  return scrapeMode === "only-fitment" ? "Fitment Only" : "Full Scrape";
}

export function activityStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}
