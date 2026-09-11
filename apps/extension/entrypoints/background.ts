import { SellSimilarApiClient, SellSimilarApiError } from "@sell-similar/api-client";
import {
  isFillItemCategoryRequest,
  type FillItemCategoryResponse,
} from "../lib/category-messages.ts";
import {
  isFillItemConditionRequest,
  type FillItemConditionResponse,
} from "../lib/condition-messages.ts";
import { fillItemCategoryInPage } from "../lib/fill-item-category-main.ts";
import { fillItemConditionInPage } from "../lib/fill-ebay-condition-main.ts";
import { fetchListingHtml } from "../lib/fetch-listing-html.ts";
import {
  isFillFitmentBroadcast,
  type FillFitmentFrameResponse,
} from "../lib/fill-fitment-messages.ts";
import {
  clearFitmentPicker,
  clearFitmentViaApi,
  guardFitmentTree,
  inspectFitmentPicker,
  isFitmentMainRequest,
  keepFitmentSummaryVisible,
  persistFitmentViaApi,
  saveFitmentPicker,
  selectFitmentControl,
  type FitmentMainRequest,
  type FitmentMainResponse,
} from "../lib/fitment-main-world.ts";
import {
  isClearScrapeCacheRequest,
  isScrapeListingRequest,
  isScrapeProgressRequest,
  type ClearScrapeCacheResponseMessage,
  type ScrapeProgressResponseMessage,
} from "../lib/scrape-messages.ts";

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

async function sellfitFrameIds(tabId: number): Promise<number[]> {
  const frames = await browser.webNavigation.getAllFrames({ tabId });
  return (frames ?? [])
    .filter((frame) => frame.frameId !== 0 && /\/sellfit/i.test(frame.url))
    .map((frame) => frame.frameId);
}

async function showFitmentSummary(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: keepFitmentSummaryVisible,
    });
  } catch {
    // listing frame may have been replaced
  }
}

async function runInFrames<T>(
  tabId: number,
  func: () => T | Promise<T>,
): Promise<T | undefined> {
  const frameIds = await sellfitFrameIds(tabId);
  const targets: Array<number | undefined> = frameIds.length > 0 ? frameIds : [undefined];
  for (const frameId of targets) {
    try {
      const injected = await browser.scripting.executeScript({
        target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
        world: "MAIN",
        func,
      });
      const value = injected[0]?.result;
      if (value !== undefined) {
        return value;
      }
    } catch {
      // frame may have been replaced
    }
  }
  return undefined;
}

async function handleFitmentMain(
  tabId: number,
  message: FitmentMainRequest,
): Promise<FitmentMainResponse> {
  switch (message.action) {
    case "guard": {
      const frameIds = await sellfitFrameIds(tabId);
      let patched = 0;
      let ok = false;
      for (const frameId of frameIds) {
        try {
          const injected = await browser.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            world: "MAIN",
            func: guardFitmentTree,
          });
          const value = injected[0]?.result;
          if (value?.ok) {
            ok = true;
            patched += value.patched ?? 0;
          }
        } catch {
          // frame may have been replaced
        }
      }
      return { ok: ok || frameIds.length === 0, patched };
    }
    case "dismiss": {
      await showFitmentSummary(tabId);
      return { ok: true };
    }
    case "ready": {
      const status = await runInFrames(tabId, inspectFitmentPicker);
      if (!status) {
        return { ok: false, ready: false };
      }
      return { ok: true, ...status };
    }
    case "clear": {
      const result = await runInFrames(tabId, clearFitmentPicker);
      return { ok: Boolean(result?.ok) };
    }
    case "select": {
      const frameIds = await sellfitFrameIds(tabId);
      const targets: Array<number | undefined> = frameIds.length > 0 ? frameIds : [undefined];
      for (const frameId of targets) {
        try {
          const injected = await browser.scripting.executeScript({
            target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
            world: "MAIN",
            func: selectFitmentControl,
            args: [message.field, message.value],
          });
          const value = injected[0]?.result;
          if (value?.ok) {
            return { ok: true };
          }
          if (value && !value.ok) {
            return { ok: false, error: value.error };
          }
        } catch {
          // try next frame
        }
      }
      return { ok: false, error: "Could not select fitment option" };
    }
    case "save": {
      const result = await runInFrames(tabId, saveFitmentPicker);
      return { ok: Boolean(result?.ok) };
    }
    case "persist": {
      try {
        const injected = await browser.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: persistFitmentViaApi,
          args: [message.meta, message.rows],
        });
        const value = injected[0]?.result;
        if (!value) {
          return { ok: false, error: "Persist script did not run" };
        }
        if (value.ok) {
          await showFitmentSummary(tabId);
        }
        return {
          ok: Boolean(value.ok),
          filled: value.filled,
          error: value.error,
        };
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        return { ok: false, error: messageText };
      }
    }
    case "clear-all": {
      try {
        const injected = await browser.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: clearFitmentViaApi,
          args: [message.meta],
        });
        const value = injected[0]?.result;
        if (!value) {
          return { ok: false, error: "Clear script did not run" };
        }
        if (value.ok) {
          await showFitmentSummary(tabId);
        }
        return { ok: Boolean(value.ok), cleared: value.cleared, error: value.error };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

export default defineBackground(() => {
  const api = new SellSimilarApiClient({
    baseUrl: apiBaseUrl,
    fetch: (input, init) => fetch(input, init),
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isFillItemCategoryRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({
          ok: false,
          itemCategory: false,
          reason: "No tab",
        } satisfies FillItemCategoryResponse);
        return;
      }
      void browser.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: fillItemCategoryInPage,
          args: [message.category],
        })
        .then((injected) => {
          const result = injected[0]?.result;
          sendResponse(
            result ?? {
              ok: false,
              itemCategory: false,
              reason: "Category fill script did not run",
            },
          );
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            itemCategory: false,
            reason: error instanceof Error ? error.message : String(error),
          } satisfies FillItemCategoryResponse);
        });
      return true;
    }

    if (isFillItemConditionRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({
          ok: false,
          condition: false,
          conditionDescription: false,
          reason: "No tab",
        } satisfies FillItemConditionResponse);
        return;
      }
      void browser.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: fillItemConditionInPage,
          args: [
            {
              condition: message.condition,
              conditionDescription: message.conditionDescription,
            },
          ],
        })
        .then((injected) => {
          const result = injected[0]?.result;
          sendResponse(
            result ?? {
              ok: false,
              condition: false,
              conditionDescription: false,
              reason: "Condition fill script did not run",
            },
          );
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            condition: false,
            conditionDescription: false,
            reason: error instanceof Error ? error.message : String(error),
          } satisfies FillItemConditionResponse);
        });
      return true;
    }

    if (isFitmentMainRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false, error: "No tab" } satisfies FitmentMainResponse);
        return;
      }
      void handleFitmentMain(tabId, message).then(sendResponse);
      return true;
    }

    if (isFillFitmentBroadcast(message)) {
      sendResponse({ handled: false } satisfies FillFitmentFrameResponse);
      return;
    }

    if (isScrapeProgressRequest(message)) {
      void api
        .getScrapeProgress()
        .then((response) => {
          sendResponse(
            response.ok
              ? {
                  ok: true,
                  active: Boolean(response.data.active),
                  message: String(response.data.message ?? ""),
                  fitmentPage: Number(response.data.fitmentPage ?? 0),
                  fitmentRows: Number(response.data.fitmentRows ?? 0),
                }
              : { ok: false },
          );
        })
        .catch(() => {
          sendResponse({ ok: false } satisfies ScrapeProgressResponseMessage);
        });
      return true;
    }

    if (isClearScrapeCacheRequest(message)) {
      void api
        .clearScrapeCache({ listingUrl: message.listingUrl })
        .then((response) => {
          sendResponse(
            response.ok
              ? {
                  ok: true,
                  cleared: response.data.cleared,
                  ebayItemId: response.data.ebayItemId,
                }
              : { ok: false, error: response.error.message },
          );
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: apiErrorMessage(error),
          } satisfies ClearScrapeCacheResponseMessage);
        });
      return true;
    }

    if (!isScrapeListingRequest(message)) {
      return;
    }

    console.log(`[Background] 📊 Scraping: ${message.listingUrl}`);
    console.log(`[Background] 📊 Scrape mode: ${message.scrapeMode}`);
    void fetchListingHtml(message.listingUrl)
      .then((html) =>
        api.scrapeListing({
          listingUrl: message.listingUrl,
          html,
          scrapeMode: message.scrapeMode,
        }),
      )
      .then((response) => {
        if (!response.ok) {
          console.log(`[Background] ❌ Scrape failed:`, response.error);
          sendResponse({
            ok: false,
            error: response.error.message,
          });
          return;
        }

        console.log(`[Background] ✅ Scrape successful`);
        console.log(`[Background] 📊 Compatibility count: ${response.data.compatibility?.length || 0}`);
        console.log(`[Background] 📊 Fitment count: ${response.data.fitment?.length || 0}`);

        sendResponse({
          ok: true,
          data: response.data,
        });
      })
      .catch((error: unknown) => {
        console.log(`[Background] ❌ Error:`, error);
        sendResponse({
          ok: false,
          error: apiErrorMessage(error),
        });
      });

    return true;
  });
});
