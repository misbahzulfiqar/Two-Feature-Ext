import {
  ebayItemIdFromListingUrl,
  type ItemSpecific,
  type ScrapedListingData,
  type ScrapeMode,
  type VehicleCompatibility,
} from "@sell-similar/contracts";
import {
  CLEAR_SCRAPE_CACHE,
  REPORT_APPLY,
  SCRAPE_LISTING,
  SCRAPE_PROGRESS,
  type ClearScrapeCacheResponseMessage,
  type ScrapeListingResponseMessage,
  type ScrapeProgressResponseMessage,
} from "./scrape-messages.ts";

const ITEM_ID_PATTERN = /^\d{6,}$/;

export type ScrapedListing = {
  itemSpecifics: ItemSpecific[];
  fitment: VehicleCompatibility[];
  compatibility: VehicleCompatibility[];
  compatibilityCount: number;
  jobId?: string;
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
    itemSpecifics: Array.isArray(data.itemSpecifics) ? data.itemSpecifics : [],
    fitment: compatibility,
    compatibility,
    compatibilityCount: data.compatibilityCount ?? compatibility.length,
    jobId: undefined,
  };
}

/**
 * Live status of the scrape the worker is running right now (HTTP poll, not a
 * WebSocket). Returns undefined when nothing is running or the lookup fails —
 * progress is best-effort and must never interrupt a scrape.
 */
export async function readScrapeProgress(): Promise<string | undefined> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: SCRAPE_PROGRESS,
    })) as ScrapeProgressResponseMessage | undefined;
    if (!response?.ok || !response.active || !response.message) {
      return undefined;
    }
    return response.message;
  } catch {
    return undefined;
  }
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

  return {
    ...toScrapedListing(response.data),
    jobId: response.jobId,
  };
}

/**
 * Clear the cached scrape for whatever the user typed in the source field.
 * Accepts the same URL or bare item ID as a normal scrape.
 */
export async function clearSourceListingCache(
  source: string,
): Promise<{ cleared: number; ebayItemId: string }> {
  const listingUrl = resolveSourceListingUrl(source);
  const response = (await browser.runtime.sendMessage({
    type: CLEAR_SCRAPE_CACHE,
    listingUrl,
  })) as ClearScrapeCacheResponseMessage | undefined;

  if (!response?.ok) {
    throw new Error(response?.error || "Could not clear the cache");
  }
  return { cleared: response.cleared, ebayItemId: response.ebayItemId };
}

export async function reportApplyResult(input: {
  jobId?: string;
  fitmentCount?: number;
  imageCount?: number;
  warningCount: number;
  warnings?: string[];
}): Promise<void> {
  if (!input.jobId) {
    return;
  }
  try {
    await browser.runtime.sendMessage({
      type: REPORT_APPLY,
      jobId: input.jobId,
      fitmentCount: input.fitmentCount,
      imageCount: input.imageCount,
      warningCount: input.warningCount,
      warnings: input.warnings,
    });
  } catch {
    // History recording is best-effort and must not block listing apply.
  }
}
