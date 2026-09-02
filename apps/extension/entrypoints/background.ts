import { SellSimilarApiClient, SellSimilarApiError } from "@sell-similar/api-client";
import { isScrapeListingRequest } from "../lib/scrape-messages.ts";

const apiBaseUrl =
  import.meta.env.WXT_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:3001";

function apiErrorMessage(error: unknown): string {
  if (error instanceof SellSimilarApiError && error.body && typeof error.body === "object") {
    const body = error.body as {
      error?: { message?: string };
      message?: string;
    };
    if (body.error?.message) {
      return body.error.message;
    }
    if (body.message) {
      return body.message;
    }
  }
  if (error instanceof TypeError) {
    return `Could not reach the API at ${apiBaseUrl}. Start it with: pnpm --filter @sell-similar/api dev`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Could not scrape listing";
}

async function fetchListingHtml(listingUrl: string): Promise<string> {
  const response = await fetch(listingUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Could not load listing (${response.status})`);
  }
  const html = await response.text();
  if (/sorry[\s\S]{0,80}something went wrong on our end/i.test(html)) {
    throw new Error("eBay returned an error page for that listing");
  }
  return html;
}

export default defineBackground(() => {
  const api = new SellSimilarApiClient({
    baseUrl: apiBaseUrl,
    fetch: (input, init) => fetch(input, init),
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isScrapeListingRequest(message)) {
      return;
    }

    void fetchListingHtml(message.listingUrl)
      .then((html) => api.scrapeListing({ listingUrl: message.listingUrl, html }))
      .then((response) => {
        if (!response.ok) {
          sendResponse({
            ok: false,
            error: response.error.message,
          });
          return;
        }

        sendResponse({
          ok: true,
          data: response.data,
        });
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: apiErrorMessage(error),
        });
      });

    return true;
  });
});
