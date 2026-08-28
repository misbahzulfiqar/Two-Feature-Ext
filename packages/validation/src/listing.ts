import {
  LISTING_CONDITIONS,
  MARKETPLACES,
  type ListingCondition,
  type ListingDetails,
  type ListingSummary,
  type Marketplace,
  type Money,
} from "@sell-similar/contracts";
import { z } from "zod";
import type { AssertContract } from "./assert-contract.js";

export const moneySchema = z.object({
  amount: z.string().min(1),
  currency: z.string().length(3),
});

export const marketplaceSchema = z.enum(MARKETPLACES);
export const listingConditionSchema = z.enum(LISTING_CONDITIONS);

export const listingSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  price: moneySchema,
  marketplace: marketplaceSchema,
  itemUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
});

export const listingDetailsSchema = listingSummarySchema.extend({
  condition: listingConditionSchema,
  description: z.string().optional(),
  specifics: z.record(z.string(), z.string()),
});

export const sellSimilarRequestSchema = z.object({
  sourceListingUrl: z.string().url(),
});

export type ParsedMoney = AssertContract<z.infer<typeof moneySchema>, Money>;
export type ParsedMarketplace = AssertContract<
  z.infer<typeof marketplaceSchema>,
  Marketplace
>;
export type ParsedListingCondition = AssertContract<
  z.infer<typeof listingConditionSchema>,
  ListingCondition
>;
export type ParsedListingSummary = AssertContract<
  Omit<z.infer<typeof listingSummarySchema>, "id"> & {
    id: ListingSummary["id"];
  },
  ListingSummary
>;
export type ParsedListingDetails = AssertContract<
  Omit<z.infer<typeof listingDetailsSchema>, "id"> & {
    id: ListingDetails["id"];
  },
  ListingDetails
>;
