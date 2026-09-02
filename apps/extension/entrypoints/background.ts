import { isScrapeListingHtmlRequest } from "../lib/scrape-messages.ts";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isScrapeListingHtmlRequest(message)) {
      return;
    }

    void fetch(message.listingUrl, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({
            ok: false,
            error: `Could not load listing (${response.status})`,
          });
          return;
        }

        sendResponse({
          ok: true,
          html: await response.text(),
        });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not load listing",
        });
      });

    return true;
  });
});
