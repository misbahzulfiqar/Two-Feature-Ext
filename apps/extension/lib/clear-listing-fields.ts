import { clearEbayListingFitment } from "./fill-ebay-fitment.ts";
import { clearEbayListingImages } from "./fill-ebay-images.ts";
import { clearEbayListingSpecifics } from "./fill-ebay-specifics.ts";
import { clearEbayListingTitle } from "./fill-ebay-title.ts";

export type ClearableField = "title" | "images" | "specifics" | "fitment";

export type ClearListingFieldsResult = {
  /** Human-readable outcome per field, in the order they were cleared. */
  done: string[];
  failed: string[];
};

/**
 * Clear the eBay listing fields this extension writes to. Only fields the
 * extension fills are touched, and only the ones asked for.
 *
 * Item category and condition are deliberately excluded: eBay requires a value
 * for both, so there is nothing valid to clear them to.
 */
export async function clearFilledListingFields(
  fields: ReadonlySet<ClearableField>,
): Promise<ClearListingFieldsResult> {
  const done: string[] = [];
  const failed: string[] = [];

  if (fields.has("title")) {
    try {
      if (clearEbayListingTitle()) {
        done.push("title");
      } else {
        failed.push("title (field not found)");
      }
    } catch (error) {
      failed.push(`title (${message(error)})`);
    }
  }

  if (fields.has("images")) {
    try {
      const removed = await clearEbayListingImages();
      done.push(removed === 1 ? "1 photo" : `${removed} photos`);
    } catch (error) {
      failed.push(`photos (${message(error)})`);
    }
  }

  if (fields.has("specifics")) {
    try {
      await clearEbayListingSpecifics();
      done.push("item specifics");
    } catch (error) {
      failed.push(`item specifics (${message(error)})`);
    }
  }

  if (fields.has("fitment")) {
    try {
      const result = await clearEbayListingFitment();
      if (result.ok) {
        done.push(
          result.cleared > 0
            ? `vehicle compatibility (${result.cleared} entries)`
            : "vehicle compatibility (nothing saved)",
        );
      } else {
        failed.push(`vehicle compatibility (${result.error ?? "failed"})`);
      }
    } catch (error) {
      failed.push(`vehicle compatibility (${message(error)})`);
    }
  }

  return { done, failed };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
