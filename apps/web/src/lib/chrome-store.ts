import { publicEnv } from "./env";

const STORE_DETAIL_ID =
  /(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore)\/detail\/(?:[^/?#]+\/)?([a-p]{32})(?:[/?#]|$)/i;

export function chromeStoreListingUrl(): string | null {
  const url = publicEnv().webstoreUrl.trim();
  if (!url || !STORE_DETAIL_ID.test(url)) {
    return null;
  }
  return url;
}

export function configuredExtensionId(): string {
  const fromEnv = publicEnv().extensionId.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const match = publicEnv().webstoreUrl.match(STORE_DETAIL_ID);
  return match?.[1] ?? "";
}

export function hasChromeStoreListing(): boolean {
  return Boolean(chromeStoreListingUrl());
}

export function openChromeStoreInstall(): boolean {
  const listing = chromeStoreListingUrl();
  if (!listing) {
    return false;
  }
  window.open(listing, "_blank", "noopener");
  return true;
}
