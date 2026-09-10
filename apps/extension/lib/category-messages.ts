import type { ListingCategory } from "@sell-similar/contracts";

export const FILL_ITEM_CATEGORY = "SELL_SIMILAR_FILL_ITEM_CATEGORY";

export type FillItemCategoryRequest = {
  type: typeof FILL_ITEM_CATEGORY;
  category: ListingCategory;
};

export type FillItemCategoryResponse = {
  ok: boolean;
  itemCategory: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemCategoryRequest(
  message: unknown,
): message is FillItemCategoryRequest {
  if (!isRecord(message) || message.type !== FILL_ITEM_CATEGORY) {
    return false;
  }
  if (!isRecord(message.category)) {
    return false;
  }
  return (
    typeof message.category.id === "string" &&
    typeof message.category.name === "string" &&
    Array.isArray(message.category.path)
  );
}
