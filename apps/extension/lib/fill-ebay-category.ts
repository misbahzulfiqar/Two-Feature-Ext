import type { ListingCategory } from "@sell-similar/contracts";

export const FILL_ITEM_CATEGORY = "SELL_SIMILAR_FILL_ITEM_CATEGORY";

export type FillItemCategoryRequest = {
  type: typeof FILL_ITEM_CATEGORY;
  category: ListingCategory;
};

export type FillItemCategoryResult = {
  ok: boolean;
  itemCategory: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemCategoryRequest(message: unknown): message is FillItemCategoryRequest {
  if (!isRecord(message) || message.type !== FILL_ITEM_CATEGORY || !isRecord(message.category)) {
    return false;
  }
  return (
    typeof message.category.id === "string" &&
    typeof message.category.name === "string" &&
    Array.isArray(message.category.path)
  );
}

/**
 * Ask the listing page to select the source item category.
 * Store categories are not applied. Messaging failures become a false result;
 * the panel uses the boolean, and the page logs the detailed reason.
 */
export async function fillEbayListingCategories(
  category: ListingCategory,
): Promise<{ itemCategory: boolean }> {
  console.log("[SellSimilar][item-category] request", category);
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_CATEGORY,
      category,
    })) as FillItemCategoryResult | undefined;
    console.log("[SellSimilar][item-category] result", response);
    return { itemCategory: Boolean(response?.itemCategory) };
  } catch (error) {
    console.log("[SellSimilar][item-category] message failed", error);
    return { itemCategory: false };
  }
}
