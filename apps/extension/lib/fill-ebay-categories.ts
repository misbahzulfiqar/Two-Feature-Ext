import type { ListingCategory } from "@sell-similar/contracts";
import {
  FILL_ITEM_CATEGORY,
  type FillItemCategoryResponse,
} from "./category-messages.ts";

export type FillCategoriesResult = {
  itemCategory: boolean;
};

export async function fillEbayListingCategories(
  category: ListingCategory,
): Promise<FillCategoriesResult> {
  console.log("[SellSimilar][item-category] requesting MAIN-world fill", category);
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_CATEGORY,
      category,
    })) as FillItemCategoryResponse | undefined;
    console.log("[SellSimilar][item-category] MAIN result", response);
    return { itemCategory: Boolean(response?.itemCategory) };
  } catch (error) {
    console.error("[SellSimilar][item-category] MAIN fill failed", error);
    return { itemCategory: false };
  }
}
