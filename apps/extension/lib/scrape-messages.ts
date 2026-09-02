export const SCRAPE_LISTING_HTML = "scrape-listing-html";

export type ScrapeListingHtmlRequest = {
  type: typeof SCRAPE_LISTING_HTML;
  listingUrl: string;
};

export type ScrapeListingHtmlResponse =
  | { ok: true; html: string }
  | { ok: false; error: string };

export function isScrapeListingHtmlRequest(
  message: unknown,
): message is ScrapeListingHtmlRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  if (!("type" in message) || !("listingUrl" in message)) {
    return false;
  }

  return (
    message.type === SCRAPE_LISTING_HTML && typeof message.listingUrl === "string"
  );
}
