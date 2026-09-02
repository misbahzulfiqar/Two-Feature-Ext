import type { CorrelationId, JobId, ListingId, UserId } from "./ids.js";

export const JOB_NAMES = [
  "scrape-listing",
  "scrape-similar",
  "refresh-fitment",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export type ScrapeListingJobPayload = {
  listingUrl: string;
  requestedBy?: UserId;
  correlationId: CorrelationId;
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
