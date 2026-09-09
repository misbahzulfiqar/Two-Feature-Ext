import type { VehicleCompatibility } from "@sell-similar/contracts";

export const FILL_FITMENT_BROADCAST = "SELL_SIMILAR_FILL_FITMENT_BROADCAST";
export const FILL_FITMENT_MESSAGE = "SELL_SIMILAR_FILL_FITMENT";
export const FILL_FITMENT_RESULT = "SELL_SIMILAR_FILL_FITMENT_RESULT";

export type FitmentWorkflowCode =
  | "FITMENT_EMPTY"
  | "TARGET_EDITOR_CHANGED"
  | "FITMENT_PICKER_TIMEOUT"
  | "VERIFICATION_FAILED";

export type FillFitmentResult = {
  sectionFound: boolean;
  cleared: boolean;
  filled: number;
  skipped: number;
  warnings: string[];
  existingCount: number;
  code?: FitmentWorkflowCode;
};

export function fillFitmentResult(partial: Partial<FillFitmentResult> = {}): FillFitmentResult {
  return {
    sectionFound: false,
    cleared: false,
    filled: 0,
    skipped: 0,
    warnings: [],
    existingCount: 0,
    ...partial,
  };
}

export type FillFitmentBroadcast = {
  type: typeof FILL_FITMENT_BROADCAST;
  rows: VehicleCompatibility[];
};

export type FillFitmentFrameRequest = {
  type: typeof FILL_FITMENT_MESSAGE;
  rows: VehicleCompatibility[];
};

export type FillFitmentFrameResponse =
  | { handled: true; result: FillFitmentResult }
  | { handled: false };

export function isFillFitmentBroadcast(message: unknown): message is FillFitmentBroadcast {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  if (!("type" in message) || !("rows" in message)) {
    return false;
  }
  return message.type === FILL_FITMENT_BROADCAST && Array.isArray(message.rows);
}

export function isFillFitmentFrameRequest(message: unknown): message is FillFitmentFrameRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  if (!("type" in message) || !("rows" in message)) {
    return false;
  }
  return message.type === FILL_FITMENT_MESSAGE && Array.isArray(message.rows);
}
