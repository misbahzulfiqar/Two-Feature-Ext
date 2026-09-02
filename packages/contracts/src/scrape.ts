import type { ApiResponse } from "./api.js";

export type ItemSpecific = {
  key: string;
  value: string;
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
  category: ListingCategory;
  storeCategories: StoreCategory[];
  fitment: unknown[];
};

export type ScrapeListingRequest = {
  listingUrl: string;
  html?: string;
};

export type ScrapeListingResponse = ApiResponse<ScrapedListingData>;
