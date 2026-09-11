export {
  normalizeFitment,
  normalizedListingSchema,
  vehicleFitmentSchema,
} from "./fitment.js";
export type { NormalizedListing, VehicleFitment } from "./fitment.js";
export {
  completeScrapeJob,
  createQueuedScrapeJob,
  failScrapeJob,
  findReusableScrapeJob,
  getMongoClient,
  getScrapeJobById,
  getScrapeJobsCollection,
  markScrapeJobProcessing,
  toScrapeJobRecord,
  updateScrapeJobProgress,
} from "./scrape-job-store.js";
export type { ScrapeJobDocument } from "./scrape-job-store.js";
