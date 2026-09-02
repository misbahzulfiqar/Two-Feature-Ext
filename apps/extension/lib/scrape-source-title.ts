import type {
  ItemSpecific,
  ListingCategory,
  ScrapedListingData,
  StoreCategory,
} from "@sell-similar/contracts";
import {
  SCRAPE_LISTING,
  type ScrapeListingResponseMessage,
} from "./scrape-messages.ts";

const ITEM_ID_PATTERN = /^\d{6,}$/;

export type ScrapedListing = {
  title: string;
  images: string[];
  itemSpecifics: ItemSpecific[];
  category: ListingCategory;
  storeCategories: StoreCategory[];
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

function toScrapedListing(data: ScrapedListingData): ScrapedListing {
  return {
    title: data.title ?? "",
    images: Array.isArray(data.images) ? data.images : [],
    itemSpecifics: Array.isArray(data.itemSpecifics) ? data.itemSpecifics : [],
    category: data.category ?? { id: "", name: "", path: [] },
    storeCategories: Array.isArray(data.storeCategories) ? data.storeCategories : [],
  };
}

export async function scrapeSourceListing(source: string): Promise<ScrapedListing> {
  const listingUrl = resolveSourceListingUrl(source);
  const response = (await browser.runtime.sendMessage({
    type: SCRAPE_LISTING,
    listingUrl,
  })) as ScrapeListingResponseMessage;

  if (!response?.ok) {
    throw new Error(response?.error || "Could not scrape listing");
  }

  return toScrapedListing(response.data);
}

export async function scrapeSourceTitle(source: string): Promise<string> {
  const listing = await scrapeSourceListing(source);
  return listing.title;
}
