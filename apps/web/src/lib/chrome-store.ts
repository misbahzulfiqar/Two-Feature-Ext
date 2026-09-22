import { publicEnv } from "./env";

/**
 * The extension is distributed directly to customers, not through the Chrome
 * Web Store. Its ID comes from the "key" pinned in the extension manifest:
 * without that key every "Load unpacked" install would get a different ID
 * (derived from the folder path) and this site could never detect it.
 */
export const PINNED_EXTENSION_ID = "plohbfpfbfppmlnamocnoelnefchplnm";

export function configuredExtensionId(): string {
  // An env override wins, so a differently-keyed build can be pointed at.
  const fromEnv = publicEnv().extensionId.trim();
  return fromEnv || PINNED_EXTENSION_ID;
}
