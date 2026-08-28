import type { ListingId } from "./ids.js";

export const MARKETPLACES = [
  "EBAY_US",
  "EBAY_MOTORS",
  "EBAY_UK",
  "EBAY_CA",
  "EBAY_AU",
  "EBAY_DE",
] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export const LISTING_CONDITIONS = [
  "NEW",
  "USED",
  "REFURBISHED",
  "FOR_PARTS",
] as const;

export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export type Money = {
  amount: string;
  currency: string;
};

export type ListingSummary = {
  id: ListingId;
  title: string;
  price: Money;
  marketplace: Marketplace;
  itemUrl: string;
  imageUrl?: string;
};

export type ListingDetails = ListingSummary & {
  condition: ListingCondition;
  description?: string;
  specifics: Record<string, string>;
};
