import {
  ebayItemIdFromListingUrl,
  type ItemSpecific,
  type ListingCategory,
  type ScrapedListingData,
  type ScrapeMode,
  type StoreCategory,
  type VehicleCompatibility,
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
  fitment: VehicleCompatibility[];
  compatibility: VehicleCompatibility[];
  compatibilityCount: number;
};

function isUsEbayHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === "ebay.com" || host.endsWith(".ebay.com");
}

function canonicalUsItemUrl(itemId: string): string {
  return `https://www.ebay.com/itm/${itemId}`;
}

export function resolveSourceListingUrl(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("INVALID_SOURCE. Enter a source listing URL or Item ID");
  }

  if (ITEM_ID_PATTERN.test(trimmed)) {
    return canonicalUsItemUrl(trimmed);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("INVALID_SOURCE. Enter a valid eBay listing URL or Item ID");
  }

  if (!url.hostname.toLowerCase().includes("ebay.")) {
    throw new Error("INVALID_SOURCE. Source URL must be an eBay listing");
  }

  if (!isUsEbayHost(url.hostname)) {
    throw new Error("UNSUPPORTED_MARKETPLACE. Fitment scrape supports eBay US listings only");
  }

  const itemId = ebayItemIdFromListingUrl(url.toString());
  if (!itemId) {
    throw new Error(
      "INVALID_SOURCE. Source URL must be an eBay item listing (/itm/...), not a store or seller page",
    );
  }

  return canonicalUsItemUrl(itemId);
}

function toCompatibility(rows: VehicleCompatibility[] | undefined): VehicleCompatibility[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    year: String(row.year ?? ""),
    make: String(row.make ?? ""),
    model: String(row.model ?? ""),
    trim: String(row.trim ?? ""),
    engine: String(row.engine ?? ""),
    notes: String(row.notes ?? ""),
  }));
}

function toScrapedListing(data: ScrapedListingData): ScrapedListing {
  // ✅ ADD DEBUGGING
  console.log('[SellSimilar] 📊 Raw data received:', data);
  console.log('[SellSimilar] 📊 data.compatibility:', data.compatibility);
  console.log('[SellSimilar] 📊 data.compatibility length:', data.compatibility?.length);
  console.log('[SellSimilar] 📊 data.fitment:', data.fitment);
  console.log('[SellSimilar] 📊 data.fitment length:', data.fitment?.length);
  console.log('[SellSimilar] 📊 data.compatibilityCount:', data.compatibilityCount);
  
  const compatibility = toCompatibility(
    data.compatibility?.length ? data.compatibility : data.fitment,
  );
  
  console.log('[SellSimilar] 📊 Final compatibility length:', compatibility.length);
  if (compatibility.length > 0) {
    console.log('[SellSimilar] 📊 First row:', compatibility[0]);
  }
  
  return {
    title: data.title ?? "",
    images: Array.isArray(data.images) ? data.images : [],
    itemSpecifics: Array.isArray(data.itemSpecifics) ? data.itemSpecifics : [],
    category: data.category ?? { id: "", name: "", path: [] },
    storeCategories: [],
    fitment: compatibility,
    compatibility,
    compatibilityCount: data.compatibilityCount ?? compatibility.length,
  };
}

export async function scrapeSourceListing(
  source: string,
  scrapeMode: ScrapeMode = "full-scrape",
): Promise<ScrapedListing> {
  const listingUrl = resolveSourceListingUrl(source);
  const response = (await browser.runtime.sendMessage({
    type: SCRAPE_LISTING,
    listingUrl,
    scrapeMode,
  })) as ScrapeListingResponseMessage;

  if (!response?.ok) {
    throw new Error(response?.error || "Couldn't scrape listing");
  }

  return toScrapedListing(response.data);
}

export async function scrapeSourceTitle(source: string): Promise<string> {
  const listing = await scrapeSourceListing(source, "full-scrape");
  return listing.title;
}
