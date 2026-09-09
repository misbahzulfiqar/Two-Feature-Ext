import type {
  ItemSpecific,
  ListingCategory,
  ScrapeListingRequest,
  ScrapedListingData,
  StoreCategory,
  VehicleCompatibility,
} from "@sell-similar/contracts";
import { z } from "zod";
import type { AssertContract } from "./assert-contract.js";

function isEbayItemUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      parsed.hostname.toLowerCase().includes("ebay.") &&
      (path === "/itm" || path.startsWith("/itm/"))
    );
  } catch {
    return false;
  }
}

export const scrapeListingRequestSchema = z.object({
  listingUrl: z
    .string()
    .url()
    .refine(isEbayItemUrl, "Source URL must be an eBay item listing (/itm/...)"),
  html: z.string().min(1).optional(),
  scrapeMode: z.enum(["full-scrape", "only-fitment"]).optional(),
});

export const itemSpecificSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const listingCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.array(z.string()),
});

export const storeCategorySchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  path: z.array(z.string()).optional(),
});

export const vehicleCompatibilitySchema = z.object({
  year: z.string(),
  make: z.string(),
  model: z.string(),
  trim: z.string().optional().default(""),
  engine: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const scrapedListingDataSchema = z.object({
  title: z.string().default(""),
  sku: z.string().default(""),
  price: z.string().default(""),
  images: z.array(z.string()).default([]),
  itemSpecifics: z.array(itemSpecificSchema).default([]),
  category: listingCategorySchema.default({ id: "", name: "", path: [] }),
  storeCategories: z.array(storeCategorySchema).default([]),
  fitment: z.array(vehicleCompatibilitySchema).default([]),
  compatibility: z.array(vehicleCompatibilitySchema).default([]),
  compatibilityCount: z.number().int().nonnegative().default(0),
});

export type ParsedScrapeListingRequest = AssertContract<
  z.infer<typeof scrapeListingRequestSchema>,
  ScrapeListingRequest
>;
export type ParsedItemSpecific = AssertContract<
  z.infer<typeof itemSpecificSchema>,
  ItemSpecific
>;
export type ParsedListingCategory = AssertContract<
  z.infer<typeof listingCategorySchema>,
  ListingCategory
>;
export type ParsedStoreCategory = AssertContract<
  z.infer<typeof storeCategorySchema>,
  StoreCategory
>;
export type ParsedVehicleCompatibility = AssertContract<
  z.infer<typeof vehicleCompatibilitySchema>,
  VehicleCompatibility
>;
export type ParsedScrapedListingData = AssertContract<
  z.infer<typeof scrapedListingDataSchema>,
  ScrapedListingData
>;
