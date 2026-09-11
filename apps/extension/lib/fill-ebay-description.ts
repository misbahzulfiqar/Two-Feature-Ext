import {
  FILL_ITEM_DESCRIPTION,
  type FillItemDescriptionResponse,
} from "./description-messages.ts";

export type FillDescriptionResult = {
  description: boolean;
};

export async function fillEbayListingDescription(description: string): Promise<FillDescriptionResult> {
  const html = description.trim();
  if (!html) {
    return { description: false };
  }
  console.log("[SellSimilar][description] requesting MAIN-world fill", { length: html.length });
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_DESCRIPTION,
      description: html,
    })) as FillItemDescriptionResponse | undefined;
    console.log("[SellSimilar][description] MAIN result", response);
    return { description: Boolean(response?.description) };
  } catch (error) {
    console.error("[SellSimilar][description] MAIN fill failed", error);
    return { description: false };
  }
}
