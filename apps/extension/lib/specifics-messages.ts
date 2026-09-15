export const FILL_ITEM_YES_NO = "SELL_SIMILAR_FILL_ITEM_YES_NO";
export const FILL_ITEM_CUSTOM = "SELL_SIMILAR_FILL_ITEM_CUSTOM";

export type FillItemYesNoRequest = {
  type: typeof FILL_ITEM_YES_NO;
  key: string;
  value: string;
};

export type FillItemYesNoResponse = {
  ok: boolean;
  reason: string;
};

export type FillItemCustomRequest = {
  type: typeof FILL_ITEM_CUSTOM;
  key: string;
  value: string;
};

export type FillItemCustomResponse = {
  ok: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemYesNoRequest(message: unknown): message is FillItemYesNoRequest {
  return (
    isRecord(message) &&
    message.type === FILL_ITEM_YES_NO &&
    typeof message.key === "string" &&
    typeof message.value === "string"
  );
}

export function isFillItemCustomRequest(message: unknown): message is FillItemCustomRequest {
  return (
    isRecord(message) &&
    message.type === FILL_ITEM_CUSTOM &&
    typeof message.key === "string" &&
    typeof message.value === "string"
  );
}
