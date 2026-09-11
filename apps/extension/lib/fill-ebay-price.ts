import {
  FILL_ITEM_PRICE,
  type FillItemPriceResponse,
} from "./price-messages.ts";

export type FillPriceResult = {
  price: boolean;
};

export async function fillEbayListingPrice(price: string): Promise<FillPriceResult> {
  const wanted = price.trim();
  if (!wanted) {
    return { price: false };
  }
  console.log("[SellSimilar][price] requesting MAIN-world fill", { price: wanted });
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_PRICE,
      price: wanted,
    })) as FillItemPriceResponse | undefined;
    console.log("[SellSimilar][price] MAIN result", response);
    return { price: Boolean(response?.price) };
  } catch (error) {
    console.error("[SellSimilar][price] MAIN fill failed", error);
    return { price: false };
  }
}
