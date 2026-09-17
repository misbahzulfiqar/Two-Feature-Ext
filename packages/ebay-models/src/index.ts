export {
  normalizeFitment,
  normalizedListingSchema,
  vehicleFitmentSchema,
} from "./fitment.js";
export type { NormalizedListing, VehicleFitment } from "./fitment.js";
export {
  applyScrapeJobResult,
  backfillScrapedListings,
  cleanupOldScrapeJobs,
  completeScrapeJob,
  countScrapeJobsForUser,
  createQueuedScrapeJob,
  failScrapeJob,
  failStuckScrapeJobs,
  findReusableScrapeJob,
  getMongoClient,
  getScrapeJobById,
  getScrapeJobsCollection,
  listScrapeJobsForUser,
  markScrapeJobProcessing,
  recordFinishedScrapeJob,
  scrapeResultCounts,
  toScrapeJobRecord,
  updateScrapeJobProgress,
} from "./scrape-job-store.js";
export type { ScrapeJobDocument } from "./scrape-job-store.js";
export {
  ebayImageIdFromUrl,
  getListingImagesCollection,
  listListingImagesForJob,
  replaceListingImages,
} from "./listing-images.js";
export type { ListingImageDocument } from "./listing-images.js";
export {
  deleteScrapedListingsForJobs,
  getScrapedListingsCollection,
  upsertScrapedListing,
} from "./scraped-listings.js";
export type { ScrapedListingDocument, ScrapedListingImageRef } from "./scraped-listings.js";
