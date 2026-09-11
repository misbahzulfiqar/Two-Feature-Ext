export const RESTORE_LISTING_PAGE = "SELL_SIMILAR_RESTORE_LISTING_PAGE";

export type RestoreListingPageRequest = {
  type: typeof RESTORE_LISTING_PAGE;
};

export type RestoreListingPageResponse = {
  ok: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRestoreListingPageRequest(
  message: unknown,
): message is RestoreListingPageRequest {
  return isRecord(message) && message.type === RESTORE_LISTING_PAGE;
}
