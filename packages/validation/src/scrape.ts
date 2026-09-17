import type {
  ClearScrapeCacheRequest,
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
  refresh: z.boolean().optional(),
});

/**
 * Accepts a full eBay item URL or a bare numeric item ID, so the clear-cache
 * button works with whatever the user typed in the source field.
 */
export const clearScrapeCacheRequestSchema = z.object({
  listingUrl: z.string().min(1),
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

export const listingWeightSchema = z.object({
  value: z.string().default(""),
  unit: z.string().default(""),
});

export const listingDimensionsSchema = z.object({
  length: z.string().default(""),
  width: z.string().default(""),
  height: z.string().default(""),
  unit: z.string().default(""),
  raw: z.string().default(""),
});

export const listingShippingSchema = z.object({
  service: z.string().default(""),
  cost: z.string().default(""),
  handlingTime: z.string().default(""),
  location: z.string().default(""),
  details: z.string().default(""),
});

export const scrapedListingDataSchema = z.object({
  title: z.string().default(""),
  sku: z.string().default(""),
  price: z.string().default(""),
  images: z.array(z.string()).default([]),
  itemSpecifics: z.array(itemSpecificSchema).default([]),
  condition: z.string().default(""),
  conditionDescription: z.string().default(""),
  description: z.string().default(""),
  category: listingCategorySchema.default({ id: "", name: "", path: [] }),
  storeCategories: z.array(storeCategorySchema).default([]),
  shipping: listingShippingSchema.default({
    service: "",
    cost: "",
    handlingTime: "",
    location: "",
    details: "",
  }),
  weight: listingWeightSchema.default({ value: "", unit: "" }),
  dimensions: listingDimensionsSchema.default({
    length: "",
    width: "",
    height: "",
    unit: "",
    raw: "",
  }),
  fitment: z.array(vehicleCompatibilitySchema).default([]),
  compatibility: z.array(vehicleCompatibilitySchema).default([]),
  compatibilityCount: z.number().int().nonnegative().default(0),
});

export type ParsedScrapeListingRequest = AssertContract<
  z.infer<typeof scrapeListingRequestSchema>,
  ScrapeListingRequest
>;
export type ParsedClearScrapeCacheRequest = AssertContract<
  z.infer<typeof clearScrapeCacheRequestSchema>,
  ClearScrapeCacheRequest
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
