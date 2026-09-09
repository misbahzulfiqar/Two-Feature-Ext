import type { CorrelationId, JobId, ListingId, UserId } from "./ids.js";
import type {
  ScrapeMode,
  ScrapeProgressStage,
  ScrapedListingData,
  VehicleCompatibility,
} from "./scrape.js";

export const JOB_NAMES = [
  "scrape-listing",
  "scrape-similar",
  "refresh-fitment",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export const SCRAPE_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export type ScrapeJobStatus = (typeof SCRAPE_JOB_STATUSES)[number];

export type ScrapeListingJobPayload = {
  listingUrl: string;
  scrapeMode?: ScrapeMode;
  correlationId: CorrelationId;
  requestedBy?: UserId;
};

export type ScrapeJobProgress = {
  stage: ScrapeProgressStage;
  percent: number;
};

export type ScrapeJobRecord = {
  jobId: string;
  ebayItemId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  status: ScrapeJobStatus;
  progress: ScrapeJobProgress;
  compatibility: VehicleCompatibility[];
  result: ScrapedListingData | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type CreateScrapeJobRequest = {
  listingUrl: string;
  scrapeMode?: ScrapeMode;
};

export type ScrapeSimilarJobPayload = {
  listingId: ListingId;
  requestedBy?: UserId;
  correlationId: CorrelationId;
};

export type RefreshFitmentJobPayload = {
  listingId: ListingId;
  correlationId: CorrelationId;
};

export type JobPayloadByName = {
  "scrape-listing": ScrapeListingJobPayload;
  "scrape-similar": ScrapeSimilarJobPayload;
  "refresh-fitment": RefreshFitmentJobPayload;
};

export type QueueJob<N extends JobName = JobName> = {
  id: JobId;
  name: N;
  payload: JobPayloadByName[N];
};
