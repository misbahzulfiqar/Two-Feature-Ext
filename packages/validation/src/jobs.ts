import { JOB_NAMES } from "@sell-similar/contracts";
import { z } from "zod";

export const jobNameSchema = z.enum(JOB_NAMES);

export const scrapeListingJobPayloadSchema = z.object({
  listingUrl: z.string().url(),
  requestedBy: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export const scrapeSimilarJobPayloadSchema = z.object({
  listingId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export const refreshFitmentJobPayloadSchema = z.object({
  listingId: z.string().min(1),
  correlationId: z.string().min(1),
});
