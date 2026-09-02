import { extractListingImagesFromDocument } from "./extract-listing-images.ts";
import { extractListingTitleFromDocument } from "./extract-listing-title.ts";
import {
  SCRAPE_LISTING_HTML,
  type ScrapeListingHtmlResponse,
} from "./scrape-messages.ts";

const ITEM_ID_PATTERN = /^\d{6,}$/;

export type ScrapedListing = {
  title: string;
  images: string[];
};

export function resolveSourceListingUrl(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("Enter a source listing URL or Item ID");
  }

  if (ITEM_ID_PATTERN.test(trimmed)) {
    return `https://www.ebay.com/itm/${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid eBay listing URL or Item ID");
  }

  if (!url.hostname.toLowerCase().includes("ebay.")) {
    throw new Error("Source URL must be an eBay listing");
  }

  const path = url.pathname.toLowerCase();
  if (path !== "/itm" && !path.startsWith("/itm/")) {
    throw new Error("Source URL must be an eBay item listing (/itm/...), not a store or seller page");
  }

  return url.toString();
}

export async function scrapeSourceListing(source: string): Promise<ScrapedListing> {
  const listingUrl = resolveSourceListingUrl(source);
  const response = (await browser.runtime.sendMessage({
    type: SCRAPE_LISTING_HTML,
    listingUrl,
  })) as ScrapeListingHtmlResponse;

  if (!response?.ok) {
    throw new Error(response?.error || "Could not load listing");
  }

  const doc = new DOMParser().parseFromString(response.html, "text/html");
  return {
    title: extractListingTitleFromDocument(doc),
    images: extractListingImagesFromDocument(doc),
  };
}

export async function scrapeSourceTitle(source: string): Promise<string> {
  const listing = await scrapeSourceListing(source);
  return listing.title;
}
