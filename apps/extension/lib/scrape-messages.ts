import type { ScrapedListingData, ScrapeMode } from "@sell-similar/contracts";

export const SCRAPE_LISTING = "scrape-listing";
export const CLEAR_SCRAPE_CACHE = "clear-scrape-cache";
export const SCRAPE_PROGRESS = "scrape-progress";

export type ScrapeListingRequestMessage = {
  type: typeof SCRAPE_LISTING;
  listingUrl: string;
  scrapeMode?: ScrapeMode;
};

export type ScrapeListingResponseMessage =
  | { ok: true; data: ScrapedListingData }
  | { ok: false; error: string };

export type ClearScrapeCacheRequestMessage = {
  type: typeof CLEAR_SCRAPE_CACHE;
  listingUrl: string;
};

export type ClearScrapeCacheResponseMessage =
  | { ok: true; cleared: number; ebayItemId: string }
  | { ok: false; error: string };

export type ScrapeProgressRequestMessage = {
  type: typeof SCRAPE_PROGRESS;
};

export type ScrapeProgressResponseMessage =
  | { ok: true; active: boolean; message: string; fitmentPage: number; fitmentRows: number }
  | { ok: false };

export function isScrapeProgressRequest(
  message: unknown,
): message is ScrapeProgressRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === SCRAPE_PROGRESS
  );
}

export function isClearScrapeCacheRequest(
  message: unknown,
): message is ClearScrapeCacheRequestMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  if (!("type" in message) || !("listingUrl" in message)) {
    return false;
  }
  return (
    message.type === CLEAR_SCRAPE_CACHE && typeof message.listingUrl === "string"
  );
}

export function isScrapeListingRequest(
  message: unknown,
): message is ScrapeListingRequestMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  if (!("type" in message) || !("listingUrl" in message)) {
    return false;
  }

  return (
    message.type === SCRAPE_LISTING && typeof message.listingUrl === "string"
  );
}
