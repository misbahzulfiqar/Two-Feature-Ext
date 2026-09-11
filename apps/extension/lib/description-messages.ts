export const FILL_ITEM_DESCRIPTION = "SELL_SIMILAR_FILL_ITEM_DESCRIPTION";

export type FillItemDescriptionRequest = {
  type: typeof FILL_ITEM_DESCRIPTION;
  description: string;
};

export type FillItemDescriptionResponse = {
  ok: boolean;
  description: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemDescriptionRequest(
  message: unknown,
): message is FillItemDescriptionRequest {
  return (
    isRecord(message) &&
    message.type === FILL_ITEM_DESCRIPTION &&
    typeof message.description === "string"
  );
}
