import type { CorrelationId, ListingId } from "./ids.js";
import type { CreateScrapeJobRequest, ScrapeJobRecord } from "./jobs.js";
import type { ListingDetails, ListingSummary } from "./listing.js";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  correlationId: CorrelationId;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  correlationId: CorrelationId;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type GetListingRequest = {
  listingId: ListingId;
};

export type GetListingResponse = ApiResponse<ListingDetails>;

export type SellSimilarRequest = {
  sourceListingUrl: string;
};

export type SellSimilarResponse = ApiResponse<{
  source: ListingDetails;
  similar: ListingSummary[];
}>;

export type HealthResponse = {
  ok: true;
  service: string;
};

export type CreateScrapeJobResponse = ApiResponse<ScrapeJobRecord>;

export type GetScrapeJobResponse = ApiResponse<ScrapeJobRecord>;

export type { CreateScrapeJobRequest };
