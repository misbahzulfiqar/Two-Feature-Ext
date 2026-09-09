import {
  EBAY_CONTENT_SCRIPT_EXCLUDE_MATCHES,
  EBAY_LISTING_EDITOR_MATCHES,
} from "../lib/content-script-matches.ts";
import { isEbayListingEditorUrl } from "../lib/ebay-listing-editor.ts";

/**
 * Do not touch Compatibility on editor load. Native eBay UI stays as-is until scrape finishes.
 */
export default defineContentScript({
  matches: [...EBAY_LISTING_EDITOR_MATCHES],
  excludeMatches: [...EBAY_CONTENT_SCRIPT_EXCLUDE_MATCHES],
  runAt: "document_start",
  world: "MAIN",
  main() {
    if (!isEbayListingEditorUrl(window.location.href)) {
      return;
    }
  },
});
