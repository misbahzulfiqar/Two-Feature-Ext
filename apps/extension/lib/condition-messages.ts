export const FILL_ITEM_CONDITION = "SELL_SIMILAR_FILL_ITEM_CONDITION";

export type FillItemConditionRequest = {
  type: typeof FILL_ITEM_CONDITION;
  condition: string;
  conditionDescription: string;
};

export type FillItemConditionResponse = {
  ok: boolean;
  condition: boolean;
  conditionDescription: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFillItemConditionRequest(
  message: unknown,
): message is FillItemConditionRequest {
  return (
    isRecord(message) &&
    message.type === FILL_ITEM_CONDITION &&
    typeof message.condition === "string" &&
    typeof message.conditionDescription === "string"
  );
}
