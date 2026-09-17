import type {
  ScrapeJobProgress,
  ScrapeJobRecord,
  ScrapeJobStatus,
  ScrapeMode,
  ScrapeProgressStage,
  ScrapedListingData,
  VehicleCompatibility,
} from "@sell-similar/contracts";
import {
  ebayItemIdFromListingUrl,
  scrapeProgressPercent,
} from "@sell-similar/contracts";
import { type Collection, type Db } from "mongodb";
import { databaseNameFromUrl, getMongoClient } from "./mongo.js";
import { getListingImagesCollection, listListingImagesForJob, replaceListingImages } from "./listing-images.js";
import { deleteScrapedListingsForJobs, getScrapedListingsCollection, upsertScrapedListing } from "./scraped-listings.js";

export { getMongoClient };

const SCRAPE_JOBS_COLLECTION = "scrapeJobs";
const DEFAULT_MARKETPLACE = "US";

export type ScrapeJobDocument = {
  jobId: string;
  userId: string | null;
  ebayItemId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  marketplace: string;
  status: ScrapeJobStatus;
  progress: ScrapeJobProgress;
  compatibility: VehicleCompatibility[];
  result: ScrapedListingData | null;
  error: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  duration: number | null;
  itemSpecificCount: number;
  fitmentCount: number;
  imageCount: number;
  warningCount: number;
  imageIds: string[];
  listingId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

let indexesReady = false;

export async function getScrapeJobsCollection(
  mongoUrl: string,
): Promise<Collection<ScrapeJobDocument>> {
  const mongo = await getMongoClient(mongoUrl);
  const db: Db = mongo.db(databaseNameFromUrl(mongoUrl));
  const collection = db.collection<ScrapeJobDocument>(SCRAPE_JOBS_COLLECTION);
  if (!indexesReady) {
    await collection.createIndex({ jobId: 1 }, { unique: true });
    await collection.createIndex({ ebayItemId: 1, createdAt: -1 });
    await collection.createIndex({ userId: 1, createdAt: -1 });
    await collection.createIndex({ status: 1, createdAt: -1 });
    await collection.createIndex({ listingId: 1 });
    indexesReady = true;
  }
  return collection;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function scrapeResultCounts(result: ScrapedListingData | null): {
  itemSpecificCount: number;
  fitmentCount: number;
  imageCount: number;
} {
  if (!result) {
    return { itemSpecificCount: 0, fitmentCount: 0, imageCount: 0 };
  }
  const compatibility = Array.isArray(result.compatibility) ? result.compatibility : [];
  const fitment = Array.isArray(result.fitment) ? result.fitment : [];
  return {
    itemSpecificCount: Array.isArray(result.itemSpecifics) ? result.itemSpecifics.length : 0,
    fitmentCount:
      compatibility.length ||
      fitment.length ||
      (typeof result.compatibilityCount === "number" ? result.compatibilityCount : 0),
    imageCount: Array.isArray(result.images) ? result.images.length : 0,
  };
}

function durationBetween(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) {
    return null;
  }
  const ms = completedAt.getTime() - startedAt.getTime();
  return ms >= 0 ? ms : null;
}

export function toScrapeJobRecord(doc: ScrapeJobDocument): ScrapeJobRecord {
  return {
    jobId: doc.jobId,
    ebayItemId: doc.ebayItemId,
    listingUrl: doc.listingUrl,
    scrapeMode: doc.scrapeMode,
    status: doc.status,
    progress: doc.progress,
    compatibility: doc.compatibility,
    result: doc.result,
    error: doc.error,
    createdAt: doc.createdAt.toISOString(),
    startedAt: toIso(doc.startedAt),
    completedAt: toIso(doc.completedAt),
    userId: doc.userId,
    marketplace: doc.marketplace,
    duration: doc.duration,
    itemSpecificCount: doc.itemSpecificCount,
    fitmentCount: doc.fitmentCount,
    imageCount: doc.imageCount,
    warningCount: doc.warningCount,
    errorCode: doc.errorCode,
    errorMessage: doc.errorMessage,
    listingId: doc.listingId ?? null,
  };
}

function progressFor(stage: ScrapeProgressStage): ScrapeJobProgress {
  return {
    stage,
    percent: scrapeProgressPercent(stage),
  };
}

async function persistListingSnapshot(
  mongoUrl: string,
  input: {
    jobId: string;
    userId?: string | null;
    ebayItemId: string;
    listingUrl: string;
    scrapeMode: ScrapeMode;
    marketplace?: string;
    result: ScrapedListingData | null;
  },
): Promise<{ stored: ScrapedListingData | null; imageIds: string[]; imageCount: number; listingId: string | null }> {
  const urls = input.result?.images ?? [];
  const images = await replaceListingImages(mongoUrl, {
    jobId: input.jobId,
    ebayItemId: input.ebayItemId,
    urls,
  });
  const imageIds = images.map((image) => image.imageId);
  let listingId: string | null = null;
  if (input.result) {
    const listing = await upsertScrapedListing(mongoUrl, {
      jobId: input.jobId,
      userId: input.userId,
      ebayItemId: input.ebayItemId,
      listingUrl: input.listingUrl,
      scrapeMode: input.scrapeMode,
      marketplace: input.marketplace || DEFAULT_MARKETPLACE,
      listing: input.result,
      images,
    });
    listingId = listing.listingId;
  }
  return {
    stored: input.result,
    imageIds,
    imageCount: images.length,
    listingId,
  };
}

async function hydrateJobDocument(
  mongoUrl: string,
  doc: ScrapeJobDocument,
): Promise<ScrapeJobDocument> {
  if (!doc.result) {
    return { ...doc, imageIds: doc.imageIds ?? [] };
  }
  const images = await listListingImagesForJob(mongoUrl, doc.jobId);
  const urls = images.map((image) => image.url);
  return {
    ...doc,
    imageIds: images.map((image) => image.imageId),
    imageCount: urls.length || doc.imageCount,
    result: { ...doc.result, images: urls },
  };
}

function emptyJobFields(input: {
  jobId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  userId?: string | null;
  marketplace?: string;
  now: Date;
}): ScrapeJobDocument {
  return {
    jobId: input.jobId,
    userId: input.userId ?? null,
    ebayItemId: ebayItemIdFromListingUrl(input.listingUrl),
    listingUrl: input.listingUrl,
    scrapeMode: input.scrapeMode,
    marketplace: input.marketplace || DEFAULT_MARKETPLACE,
    status: "queued",
    progress: progressFor("queued"),
    compatibility: [],
    result: null,
    error: null,
    errorCode: null,
    errorMessage: null,
    duration: null,
    itemSpecificCount: 0,
    fitmentCount: 0,
    imageCount: 0,
    warningCount: 0,
    imageIds: [],
    listingId: null,
    createdAt: input.now,
    startedAt: null,
    completedAt: null,
  };
}

export async function createQueuedScrapeJob(
  mongoUrl: string,
  input: {
    jobId: string;
    listingUrl: string;
    scrapeMode: ScrapeMode;
    userId?: string | null;
    marketplace?: string;
  },
): Promise<ScrapeJobRecord> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const doc = emptyJobFields({
    ...input,
    now: new Date(),
  });
  await collection.insertOne(doc);
  return toScrapeJobRecord(doc);
}

export async function recordFinishedScrapeJob(
  mongoUrl: string,
  input: {
    jobId: string;
    listingUrl: string;
    scrapeMode: ScrapeMode;
    userId?: string | null;
    marketplace?: string;
    status: "completed" | "failed";
    result?: ScrapedListingData | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt: Date;
    completedAt?: Date;
    warningCount?: number;
  },
): Promise<ScrapeJobRecord> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const completedAt = input.completedAt ?? new Date();
  const result = input.status === "completed" ? input.result ?? null : null;
  const counts = scrapeResultCounts(result);
  const compatibility = Array.isArray(result?.compatibility) ? result.compatibility : [];
  const errorMessage = input.status === "failed" ? input.errorMessage ?? "eBay scrape failed" : null;
  const ebayItemId = ebayItemIdFromListingUrl(input.listingUrl);
  const snapshot = await persistListingSnapshot(mongoUrl, {
    jobId: input.jobId,
    userId: input.userId,
    ebayItemId,
    listingUrl: input.listingUrl,
    scrapeMode: input.scrapeMode,
    marketplace: input.marketplace,
    result,
  });
  const doc: ScrapeJobDocument = {
    ...emptyJobFields({
      jobId: input.jobId,
      listingUrl: input.listingUrl,
      scrapeMode: input.scrapeMode,
      userId: input.userId,
      marketplace: input.marketplace,
      now: input.startedAt,
    }),
    status: input.status,
    progress: progressFor(input.status === "completed" ? "complete" : "normalize"),
    compatibility,
    result: snapshot.stored,
    error: errorMessage,
    errorCode: input.status === "failed" ? input.errorCode ?? "SCRAPE_FAILED" : null,
    errorMessage,
    duration: durationBetween(input.startedAt, completedAt),
    itemSpecificCount: counts.itemSpecificCount,
    fitmentCount: counts.fitmentCount,
    imageCount: snapshot.imageCount,
    warningCount: input.warningCount ?? 0,
    imageIds: snapshot.imageIds,
    listingId: snapshot.listingId,
    startedAt: input.startedAt,
    completedAt,
  };
  await collection.insertOne(doc);
  return toScrapeJobRecord(await hydrateJobDocument(mongoUrl, doc));
}

export async function markScrapeJobProcessing(
  mongoUrl: string,
  jobId: string,
  stage: ScrapeProgressStage,
): Promise<void> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const startedAt = new Date();
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "processing",
        progress: progressFor(stage),
      },
    },
  );
  await collection.updateOne({ jobId, startedAt: null }, { $set: { startedAt } });
}

export async function updateScrapeJobProgress(
  mongoUrl: string,
  jobId: string,
  stage: ScrapeProgressStage,
): Promise<void> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "processing",
        progress: progressFor(stage),
      },
    },
  );
}

export async function completeScrapeJob(
  mongoUrl: string,
  jobId: string,
  result: ScrapedListingData,
): Promise<void> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const existing = await collection.findOne({ jobId });
  const compatibility = Array.isArray(result.compatibility) ? result.compatibility : [];
  const completedAt = new Date();
  const counts = scrapeResultCounts(result);
  const snapshot = await persistListingSnapshot(mongoUrl, {
    jobId,
    userId: existing?.userId,
    ebayItemId: existing?.ebayItemId || ebayItemIdFromListingUrl(existing?.listingUrl ?? ""),
    listingUrl: existing?.listingUrl ?? "",
    scrapeMode: existing?.scrapeMode ?? "full-scrape",
    marketplace: existing?.marketplace,
    result,
  });
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "completed",
        progress: progressFor("complete"),
        compatibility,
        result: snapshot.stored,
        imageIds: snapshot.imageIds,
        listingId: snapshot.listingId,
        error: null,
        errorCode: null,
        errorMessage: null,
        duration: durationBetween(existing?.startedAt ?? existing?.createdAt ?? completedAt, completedAt),
        itemSpecificCount: counts.itemSpecificCount,
        fitmentCount: counts.fitmentCount,
        imageCount: snapshot.imageCount,
        completedAt,
      },
    },
  );
}

export async function failScrapeJob(
  mongoUrl: string,
  jobId: string,
  error: string,
  errorCode = "SCRAPE_FAILED",
): Promise<void> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const existing = await collection.findOne({ jobId });
  const completedAt = new Date();
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "failed",
        error,
        errorCode,
        errorMessage: error,
        duration: durationBetween(existing?.startedAt ?? existing?.createdAt ?? completedAt, completedAt),
        completedAt,
      },
    },
  );
}

export async function applyScrapeJobResult(
  mongoUrl: string,
  jobId: string,
  input: {
    fitmentCount?: number;
    imageCount?: number;
    warningCount: number;
  },
): Promise<ScrapeJobRecord | null> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const existing = await collection.findOne({ jobId });
  if (!existing) {
    return null;
  }
  const next = {
    warningCount: input.warningCount,
    ...(typeof input.fitmentCount === "number" ? { fitmentCount: input.fitmentCount } : {}),
    ...(typeof input.imageCount === "number" ? { imageCount: input.imageCount } : {}),
  };
  await collection.updateOne({ jobId }, { $set: next });
  return toScrapeJobRecord(await hydrateJobDocument(mongoUrl, { ...existing, ...next }));
}

/**
 * Most recent job for this item+mode that a new request can reuse instead of
 * queueing another scrape: either a completed job that is still fresh, or one
 * already queued/processing (so simultaneous requests collapse onto one run).
 *
 * Uses the { ebayItemId, createdAt } index.
 */
export async function findReusableScrapeJob(
  mongoUrl: string,
  input: {
    ebayItemId: string;
    scrapeMode: ScrapeMode;
    withinMs: number;
  },
): Promise<ScrapeJobRecord | null> {
  if (!input.ebayItemId) {
    return null;
  }
  const collection = await getScrapeJobsCollection(mongoUrl);
  const since = new Date(Date.now() - input.withinMs);
  const doc = await collection.findOne(
    {
      ebayItemId: input.ebayItemId,
      scrapeMode: input.scrapeMode,
      $or: [
        { status: "completed", completedAt: { $gte: since } },
        { status: { $in: ["queued", "processing"] }, createdAt: { $gte: since } },
      ],
    },
    { sort: { createdAt: -1 } },
  );
  return doc ? toScrapeJobRecord(await hydrateJobDocument(mongoUrl, doc)) : null;
}

export async function getScrapeJobById(
  mongoUrl: string,
  jobId: string,
): Promise<ScrapeJobRecord | null> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const doc = await collection.findOne({ jobId });
  return doc ? toScrapeJobRecord(await hydrateJobDocument(mongoUrl, doc)) : null;
}

export async function listScrapeJobsForUser(
  mongoUrl: string,
  userId: string,
  limit = 50,
): Promise<ScrapeJobRecord[]> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const docs = await collection.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(toScrapeJobRecord);
}

export async function countScrapeJobsForUser(
  mongoUrl: string,
  userId: string,
  filter: { createdAtGte?: Date; status?: ScrapeJobStatus | ScrapeJobStatus[] } = {},
): Promise<number> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const query: Record<string, unknown> = { userId };
  if (filter.createdAtGte) {
    query.createdAt = { $gte: filter.createdAtGte };
  }
  if (filter.status) {
    query.status = Array.isArray(filter.status) ? { $in: filter.status } : filter.status;
  }
  return collection.countDocuments(query);
}

export async function cleanupOldScrapeJobs(
  mongoUrl: string,
  olderThan: Date,
): Promise<number> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const stale = await collection
    .find({
      createdAt: { $lt: olderThan },
      status: { $in: ["completed", "failed"] },
    })
    .project({ jobId: 1 })
    .toArray();
  const jobIds = stale.map((job) => job.jobId);
  if (jobIds.length > 0) {
    const images = await getListingImagesCollection(mongoUrl);
    await images.deleteMany({ jobId: { $in: jobIds } });
    await deleteScrapedListingsForJobs(mongoUrl, jobIds);
  }
  const result = await collection.deleteMany({
    createdAt: { $lt: olderThan },
    status: { $in: ["completed", "failed"] },
  });
  return result.deletedCount;
}

export async function failStuckScrapeJobs(
  mongoUrl: string,
  olderThan: Date,
): Promise<number> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const completedAt = new Date();
  const result = await collection.updateMany(
    {
      status: { $in: ["queued", "processing"] },
      createdAt: { $lt: olderThan },
    },
    {
      $set: {
        status: "failed",
        errorCode: "STUCK_JOB",
        errorMessage: "Job exceeded the allowed processing time",
        error: "Job exceeded the allowed processing time",
        completedAt,
      },
    },
  );
  return result.modifiedCount;
}

export async function backfillScrapedListings(mongoUrl: string): Promise<number> {
  const jobs = await getScrapeJobsCollection(mongoUrl);
  const listings = await getScrapedListingsCollection(mongoUrl);
  const completed = await jobs
    .find({ status: "completed", result: { $ne: null } })
    .toArray();
  let written = 0;
  for (const job of completed) {
    if (!job.result) {
      continue;
    }
    const alreadyStored = await listings.findOne({ jobId: job.jobId });
    if (alreadyStored && job.listingId) {
      continue;
    }
    const urls = Array.isArray(job.result.images) ? job.result.images : [];
    let images = await listListingImagesForJob(mongoUrl, job.jobId);
    if (images.length === 0 && urls.length > 0) {
      images = await replaceListingImages(mongoUrl, {
        jobId: job.jobId,
        ebayItemId: job.ebayItemId,
        urls,
      });
    }
    const listing = await upsertScrapedListing(mongoUrl, {
      listingId: job.listingId ?? alreadyStored?.listingId,
      jobId: job.jobId,
      userId: job.userId,
      ebayItemId: job.ebayItemId,
      listingUrl: job.listingUrl,
      scrapeMode: job.scrapeMode,
      marketplace: job.marketplace,
      listing: job.result,
      images,
    });
    const nextResult = {
      ...job.result,
      images: urls.length > 0 ? urls : images.map((image) => image.url),
    };
    await jobs.updateOne(
      { jobId: job.jobId },
      {
        $set: {
          listingId: listing.listingId,
          imageIds: images.map((image) => image.imageId),
          imageCount: images.length || job.imageCount,
          result: nextResult,
        },
      },
    );
    written += 1;
  }
  return written;
}
