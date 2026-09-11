import { JOB_NAMES, SCRAPE_JOB_STATUSES, SCRAPE_PROGRESS_STAGES } from "@sell-similar/contracts";
import { z } from "zod";
import { scrapeListingRequestSchema } from "./scrape.js";

export const jobNameSchema = z.enum(JOB_NAMES);

export const scrapeListingJobPayloadSchema = z.object({
  listingUrl: z.string().url(),
  scrapeMode: z.enum(["full-scrape", "only-fitment"]).default("full-scrape"),
  requestedBy: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export const createScrapeJobRequestSchema = scrapeListingRequestSchema.pick({
  listingUrl: true,
  scrapeMode: true,
  refresh: true,
});

export const scrapeJobStatusSchema = z.enum(SCRAPE_JOB_STATUSES);

export const scrapeProgressStageSchema = z.enum(SCRAPE_PROGRESS_STAGES);

export const scrapeSimilarJobPayloadSchema = z.object({
  listingId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export const refreshFitmentJobPayloadSchema = z.object({
  listingId: z.string().min(1),
  correlationId: z.string().min(1),
});
