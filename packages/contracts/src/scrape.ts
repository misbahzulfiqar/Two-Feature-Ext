import type { ApiResponse } from "./api.js";
import { assertNever } from "./ids.js";

export const SCRAPE_MODES = ["full-scrape", "only-fitment"] as const;

export type ScrapeMode = (typeof SCRAPE_MODES)[number];

export const SCRAPE_PROGRESS_STAGES = [
  "queued",
  "worker_start",
  "source_load",
  "listing_extract",
  "fitment_extract",
  "media_extract",
  "normalize",
  "target_prepare",
  "apply_core",
  "apply_fitment_media",
  "complete",
] as const;

export type ScrapeProgressStage = (typeof SCRAPE_PROGRESS_STAGES)[number];

export function scrapeProgressPercent(stage: ScrapeProgressStage): number {
  switch (stage) {
    case "queued":
      return 5;
    case "worker_start":
      return 12;
    case "source_load":
      return 22;
    case "listing_extract":
      return 40;
    case "fitment_extract":
      return 58;
    case "media_extract":
      return 65;
    case "normalize":
      return 77;
    case "target_prepare":
      return 82;
    case "apply_core":
      return 86;
    case "apply_fitment_media":
      return 95;
    case "complete":
      return 100;
    default: {
      return assertNever(stage);
    }
  }
}

export function ebayItemIdFromListingUrl(listingUrl: string): string {
  const match = listingUrl.match(/\/itm\/(\d+)/i);
  return match?.[1] ?? "";
}

export type ScrapeProgressSnapshot = {
  active: boolean;
  listingUrl: string;
  stage: ScrapeProgressStage | null;
  message: string;
  fitmentPage: number;
  fitmentRows: number;
  startedAt: number | null;
  updatedAt: number;
};

export type ItemSpecific = {
  key: string;
  value: string;
};

export type VehicleCompatibility = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

export type ListingCategory = {
  id: string;
  name: string;
  path: string[];
};

export type StoreCategory = {
  name: string;
  id?: string;
  path?: string[];
};

export type ScrapedListingData = {
  title: string;
  sku: string;
  price: string;
  images: string[];
  itemSpecifics: ItemSpecific[];
  condition: string;
  conditionDescription: string;
  description: string;
  category: ListingCategory;
  storeCategories: StoreCategory[];
  fitment: VehicleCompatibility[];
  compatibility: VehicleCompatibility[];
  compatibilityCount: number;
};

export type ScrapeListingRequest = {
  listingUrl: string;
  html?: string;
  scrapeMode?: ScrapeMode;
  /** Bypass any cached result for this item and force a fresh scrape. */
  refresh?: boolean;
};

export type ClearScrapeCacheRequest = {
  /** Full eBay item URL or a bare numeric item ID. */
  listingUrl: string;
};

export type ClearScrapeCacheResult = {
  ebayItemId: string;
  cleared: number;
};

export type ScrapeListingResponse = ApiResponse<ScrapedListingData>;
