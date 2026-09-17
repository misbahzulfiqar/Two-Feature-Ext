import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { databaseNameFromUrl, getMongoClient } from "./mongo.js";

const LISTING_IMAGES_COLLECTION = "listingImages";

export type ListingImageDocument = {
  imageId: string;
  jobId: string;
  ebayItemId: string;
  url: string;
  ebayImageId: string;
  position: number;
  createdAt: Date;
};

let indexesReady = false;

export function ebayImageIdFromUrl(url: string): string {
  const gMatch = url.match(/\/g\/([^/?#]+)/i)?.[1];
  if (gMatch) {
    return gMatch;
  }
  const zMatch = url.match(/\/z\/([^/?#]+)/i)?.[1];
  if (zMatch) {
    return zMatch;
  }
  const base = url.replace(/\/s-l\d+\./g, "/").replace(/\/s-l\d+$/g, "");
  const withoutQuery = base.split("?")[0] ?? base;
  return withoutQuery.split("#")[0] ?? withoutQuery;
}

export async function getListingImagesCollection(
  mongoUrl: string,
): Promise<Collection<ListingImageDocument>> {
  const mongo = await getMongoClient(mongoUrl);
  const collection = mongo
    .db(databaseNameFromUrl(mongoUrl))
    .collection<ListingImageDocument>(LISTING_IMAGES_COLLECTION);
  if (!indexesReady) {
    await collection.createIndex({ imageId: 1 }, { unique: true });
    await collection.createIndex({ jobId: 1, position: 1 });
    await collection.createIndex({ ebayItemId: 1, createdAt: -1 });
    indexesReady = true;
  }
  return collection;
}

export async function replaceListingImages(
  mongoUrl: string,
  input: {
    jobId: string;
    ebayItemId: string;
    urls: string[];
  },
): Promise<ListingImageDocument[]> {
  const collection = await getListingImagesCollection(mongoUrl);
  await collection.deleteMany({ jobId: input.jobId });
  const now = new Date();
  const docs: ListingImageDocument[] = input.urls
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url, position) => ({
      imageId: randomUUID(),
      jobId: input.jobId,
      ebayItemId: input.ebayItemId,
      url,
      ebayImageId: ebayImageIdFromUrl(url),
      position,
      createdAt: now,
    }));
  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  return docs;
}

export async function listListingImagesForJob(
  mongoUrl: string,
  jobId: string,
): Promise<ListingImageDocument[]> {
  const collection = await getListingImagesCollection(mongoUrl);
  return collection.find({ jobId }).sort({ position: 1 }).toArray();
}
