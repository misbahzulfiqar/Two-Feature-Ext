import { clickFitmentExpander, clickFitmentNext, readFitmentPage } from "../lib/fitment-page.ts";
import { CLICK_FITMENT_NEXT, EXPAND_FITMENT, READ_FITMENT_PAGE } from "../lib/scrape-messages.ts";

export default defineContentScript({
  matches: ["*://*.ebay.com/*", "*://ebay.com/*"],
  excludeMatches: ["*://*.ebaystatic.com/*", "*://ir.ebaystatic.com/*", "*://rover.ebay.com/*"],
  allFrames: true,
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }
      const type = message.type;
      if (type === READ_FITMENT_PAGE) {
        sendResponse(readFitmentPage());
        return;
      }
      if (type === CLICK_FITMENT_NEXT) {
        sendResponse({ clicked: clickFitmentNext() });
        return;
      }
      if (type === EXPAND_FITMENT) {
        sendResponse({ clicked: clickFitmentExpander() });
        return;
      }
    });
  },
});
