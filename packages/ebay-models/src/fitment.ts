import { listingDetailsSchema } from "@sell-similar/validation";
import { z } from "zod";

export const vehicleFitmentSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().min(1).optional(),
  engine: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export const normalizedListingSchema = listingDetailsSchema.extend({
  fitment: z.array(vehicleFitmentSchema),
  sourceItemId: z.string().min(1).optional(),
});

export type VehicleFitment = z.infer<typeof vehicleFitmentSchema>;
export type NormalizedListing = z.infer<typeof normalizedListingSchema>;

export function normalizeFitment(
  input: unknown,
): VehicleFitment | undefined {
  const parsed = vehicleFitmentSchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}
