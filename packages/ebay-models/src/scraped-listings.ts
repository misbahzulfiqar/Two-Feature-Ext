import { randomUUID } from "node:crypto";
import type {
  ItemSpecific,
  ListingCategory,
  ListingDimensions,
  ListingShipping,
  ListingWeight,
  ScrapeMode,
  ScrapedListingData,
  StoreCategory,
  VehicleCompatibility,
} from "@sell-similar/contracts";
import type { Collection } from "mongodb";
import { databaseNameFromUrl, getMongoClient } from "./mongo.js";
import type { ListingImageDocument } from "./listing-images.js";

const SCRAPED_LISTINGS_COLLECTION = "scrapedListings";

export type ScrapedListingImageRef = {
  imageId: string;
  ebayImageId: string;
  url: string;
  position: number;
};

export type ScrapedListingDocument = {
  listingId: string;
  jobId: string;
  userId: string | null;
  ebayItemId: string;
  listingUrl: string;
  scrapeMode: ScrapeMode;
  marketplace: string;
  title: string;
  sku: string;
  price: string;
  condition: string;
  conditionDescription: string;
  description: string;
  itemSpecifics: ItemSpecific[];
  category: ListingCategory;
  storeCategories: StoreCategory[];
  shipping: ListingShipping;
  weight: ListingWeight;
  dimensions: ListingDimensions;
  fitment: VehicleCompatibility[];
  compatibility: VehicleCompatibility[];
  compatibilityCount: number;
  images: ScrapedListingImageRef[];
  imageIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

let indexesReady = false;

const emptyShipping: ListingShipping = {
  service: "",
  cost: "",
  handlingTime: "",
  location: "",
  details: "",
};

const emptyWeight: ListingWeight = { value: "", unit: "" };

const emptyDimensions: ListingDimensions = {
  length: "",
  width: "",
  height: "",
  unit: "",
  raw: "",
};

export async function getScrapedListingsCollection(
  mongoUrl: string,
): Promise<Collection<ScrapedListingDocument>> {
  const mongo = await getMongoClient(mongoUrl);
  const collection = mongo
    .db(databaseNameFromUrl(mongoUrl))
    .collection<ScrapedListingDocument>(SCRAPED_LISTINGS_COLLECTION);
  if (!indexesReady) {
    await collection.createIndex({ listingId: 1 }, { unique: true });
    await collection.createIndex({ jobId: 1 }, { unique: true });
    await collection.createIndex({ ebayItemId: 1, createdAt: -1 });
    await collection.createIndex({ userId: 1, createdAt: -1 });
    indexesReady = true;
  }
  return collection;
}

export async function upsertScrapedListing(
  mongoUrl: string,
  input: {
    listingId?: string;
    jobId: string;
    userId?: string | null;
    ebayItemId: string;
    listingUrl: string;
    scrapeMode: ScrapeMode;
    marketplace: string;
    listing: ScrapedListingData;
    images: ListingImageDocument[];
  },
): Promise<ScrapedListingDocument> {
  const collection = await getScrapedListingsCollection(mongoUrl);
  const existing = await collection.findOne({ jobId: input.jobId });
  const listingId = existing?.listingId ?? input.listingId ?? randomUUID();
  const now = new Date();
  const compatibility = Array.isArray(input.listing.compatibility)
    ? input.listing.compatibility
    : [];
  const fitment = Array.isArray(input.listing.fitment) ? input.listing.fitment : compatibility;
  const images: ScrapedListingImageRef[] = input.images.map((image) => ({
    imageId: image.imageId,
    ebayImageId: image.ebayImageId,
    url: image.url,
    position: image.position,
  }));
  const doc: ScrapedListingDocument = {
    listingId,
    jobId: input.jobId,
    userId: input.userId ?? null,
    ebayItemId: input.ebayItemId,
    listingUrl: input.listingUrl,
    scrapeMode: input.scrapeMode,
    marketplace: input.marketplace,
    title: input.listing.title ?? "",
    sku: input.listing.sku ?? "",
    price: input.listing.price ?? "",
    condition: input.listing.condition ?? "",
    conditionDescription: input.listing.conditionDescription ?? "",
    description: input.listing.description ?? "",
    itemSpecifics: Array.isArray(input.listing.itemSpecifics) ? input.listing.itemSpecifics : [],
    category: input.listing.category ?? { id: "", name: "", path: [] },
    storeCategories: Array.isArray(input.listing.storeCategories)
      ? input.listing.storeCategories
      : [],
    shipping: input.listing.shipping ?? emptyShipping,
    weight: input.listing.weight ?? emptyWeight,
    dimensions: input.listing.dimensions ?? emptyDimensions,
    fitment,
    compatibility,
    compatibilityCount:
      typeof input.listing.compatibilityCount === "number"
        ? input.listing.compatibilityCount
        : compatibility.length,
    images,
    imageIds: images.map((image) => image.imageId),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await collection.updateOne(
    { jobId: input.jobId },
    { $set: doc },
    { upsert: true },
  );
  return doc;
}

export async function deleteScrapedListingsForJobs(
  mongoUrl: string,
  jobIds: string[],
): Promise<void> {
  if (jobIds.length === 0) {
    return;
  }
  const collection = await getScrapedListingsCollection(mongoUrl);
  await collection.deleteMany({ jobId: { $in: jobIds } });
}
