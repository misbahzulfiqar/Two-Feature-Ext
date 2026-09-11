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
import { MongoClient, type Collection, type Db } from "mongodb";

const SCRAPE_JOBS_COLLECTION = "scrapeJobs";
const DEFAULT_DATABASE = "sell-similar";

export type ScrapeJobDocument = {
  jobId: string;
  ebayItemId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  status: ScrapeJobStatus;
  progress: ScrapeJobProgress;
  compatibility: VehicleCompatibility[];
  result: ScrapedListingData | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

let client: MongoClient | undefined;
let connectedUrl: string | undefined;
let indexesReady = false;

function databaseNameFromUrl(mongoUrl: string): string {
  const withoutQuery = mongoUrl.split("?")[0] ?? mongoUrl;
  const afterHost = withoutQuery.replace(/^mongodb(\+srv)?:\/\/[^/]*/i, "");
  const name = decodeURIComponent(afterHost.replace(/^\//, "").split("/")[0] ?? "").trim();
  return name || DEFAULT_DATABASE;
}

export async function getMongoClient(mongoUrl: string): Promise<MongoClient> {
  if (client && connectedUrl === mongoUrl) {
    return client;
  }
  if (client) {
    await client.close();
    client = undefined;
    indexesReady = false;
  }
  client = new MongoClient(mongoUrl);
  await client.connect();
  connectedUrl = mongoUrl;
  return client;
}

export async function getScrapeJobsCollection(
  mongoUrl: string,
): Promise<Collection<ScrapeJobDocument>> {
  const mongo = await getMongoClient(mongoUrl);
  const db: Db = mongo.db(databaseNameFromUrl(mongoUrl));
  const collection = db.collection<ScrapeJobDocument>(SCRAPE_JOBS_COLLECTION);
  if (!indexesReady) {
    await collection.createIndex({ jobId: 1 }, { unique: true });
    await collection.createIndex({ ebayItemId: 1, createdAt: -1 });
    indexesReady = true;
  }
  return collection;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
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
  };
}

function progressFor(stage: ScrapeProgressStage): ScrapeJobProgress {
  return {
    stage,
    percent: scrapeProgressPercent(stage),
  };
}

export async function createQueuedScrapeJob(
  mongoUrl: string,
  input: {
    jobId: string;
    listingUrl: string;
    scrapeMode: ScrapeMode;
  },
): Promise<ScrapeJobRecord> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const now = new Date();
  const doc: ScrapeJobDocument = {
    jobId: input.jobId,
    ebayItemId: ebayItemIdFromListingUrl(input.listingUrl),
    listingUrl: input.listingUrl,
    scrapeMode: input.scrapeMode,
    status: "queued",
    progress: progressFor("queued"),
    compatibility: [],
    result: null,
    error: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };
  await collection.insertOne(doc);
  return toScrapeJobRecord(doc);
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
  const compatibility = Array.isArray(result.compatibility) ? result.compatibility : [];
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "completed",
        progress: progressFor("complete"),
        compatibility,
        result,
        error: null,
        completedAt: new Date(),
      },
    },
  );
}

export async function failScrapeJob(
  mongoUrl: string,
  jobId: string,
  error: string,
): Promise<void> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: "failed",
        error,
        completedAt: new Date(),
      },
    },
  );
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
  return doc ? toScrapeJobRecord(doc) : null;
}

export async function getScrapeJobById(
  mongoUrl: string,
  jobId: string,
): Promise<ScrapeJobRecord | null> {
  const collection = await getScrapeJobsCollection(mongoUrl);
  const doc = await collection.findOne({ jobId });
  return doc ? toScrapeJobRecord(doc) : null;
}
