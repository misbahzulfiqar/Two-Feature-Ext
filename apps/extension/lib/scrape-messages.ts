import type { ScrapedListingData, ScrapeMode } from "@sell-similar/contracts";

export const SCRAPE_LISTING = "scrape-listing";

export type ScrapeListingRequestMessage = {
  type: typeof SCRAPE_LISTING;
  listingUrl: string;
  scrapeMode?: ScrapeMode;
};

export type ScrapeListingResponseMessage =
  | { ok: true; data: ScrapedListingData }
  | { ok: false; error: string };

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
