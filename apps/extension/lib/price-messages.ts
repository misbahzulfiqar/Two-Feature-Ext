export const FILL_ITEM_PRICE = "SELL_SIMILAR_FILL_ITEM_PRICE";

export type FillItemPriceRequest = {
  type: typeof FILL_ITEM_PRICE;
  price: string;
};

export type FillItemPriceResponse = {
  ok: boolean;
  price: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemPriceRequest(message: unknown): message is FillItemPriceRequest {
  return isRecord(message) && message.type === FILL_ITEM_PRICE && typeof message.price === "string";
}
