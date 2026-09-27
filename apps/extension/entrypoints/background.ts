import { SellSimilarApiClient, SellSimilarApiError } from "@sell-similar/api-client";
import { addCustomItemSpecificInPage, fillItemYesNoInPage } from "../lib/fill-ebay-specifics-main.ts";
import { restoreListingPageInPage } from "../lib/restore-listing-page-main.ts";
import {
  isFillItemCustomRequest,
  isFillItemYesNoRequest,
  type FillItemCustomResponse,
  type FillItemYesNoResponse,
} from "../lib/specifics-messages.ts";
import {
  isRestoreListingPageRequest,
  type RestoreListingPageResponse,
} from "../lib/restore-messages.ts";
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
  persistFitmentViaApi,
  saveFitmentPicker,
  selectFitmentControl,
  type FitmentMainRequest,
  type FitmentMainResponse,
} from "../lib/fitment-main-world.ts";
import {
  isClearScrapeCacheRequest,
  isReportApplyRequest,
  isScrapeListingRequest,
  isScrapeProgressRequest,
  type ClearScrapeCacheResponseMessage,
  type ReportApplyResponseMessage,
  type ScrapeProgressResponseMessage,
} from "../lib/scrape-messages.ts";

const apiBaseUrl =
  import.meta.env.WXT_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:3001";

const extensionInstalledUrl =
  import.meta.env.WXT_EXTENSION_INSTALLED_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:3004/extension-installed";

const PRODUCTION_WEB_ORIGINS = [
  "https://extension.carvmax.com",
  "https://extension-admin.carvmax.com",
] as const;

function isAllowedWebOrigin(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const origin = new URL(url).origin;
    if (PRODUCTION_WEB_ORIGINS.includes(origin as (typeof PRODUCTION_WEB_ORIGINS)[number])) {
      return true;
    }
    return import.meta.env.DEV && (origin === "http://localhost:3004" || origin === "http://127.0.0.1:3004");
  } catch {
    return false;
  }
}

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

async function unregisterStaleFitmentScripts(): Promise<void> {
  try {
    const scripts = await browser.scripting.getRegisteredContentScripts();
    const staleIds = scripts
      .filter((script) => {
        const hay = [script.id, ...(script.js ?? []), ...(script.matches ?? [])].join(" ");
        return /fitment-frame|hide-fitment|sellfit/i.test(hay);
      })
      .map((script) => script.id);
    if (staleIds.length > 0) {
      await browser.scripting.unregisterContentScripts({ ids: staleIds });
    }
  } catch {
    // Older Chrome or missing permission — ignore.
  }
}

export default defineBackground(() => {
  void unregisterStaleFitmentScripts();
  browser.runtime.onInstalled.addListener((details) => {
    void unregisterStaleFitmentScripts();
    if (details.reason === "install") {
      void browser.tabs.create({ url: extensionInstalledUrl });
    }
  });

  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!isAllowedWebOrigin(sender.url)) {
      sendResponse({ ok: false });
      return;
    }
    if (message && typeof message === "object" && "type" in message) {
      if (message.type === "EBAY_SELL_SIMILAR_PING") {
        sendResponse({
          installed: true,
          extensionName: "eBay Sell Similar",
          version: browser.runtime.getManifest().version,
        });
        return;
      }
      if (
        message.type === "EBAY_SELL_SIMILAR_PAIR" &&
        "token" in message &&
        typeof message.token === "string"
      ) {
        void fetch(`${apiBaseUrl}/extension/pairing/exchange`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: message.token }),
        })
          .then(async (response) => {
            const payload: unknown = await response.json();
            if (
              payload &&
              typeof payload === "object" &&
              "ok" in payload &&
              payload.ok === true &&
              "data" in payload &&
              payload.data &&
              typeof payload.data === "object"
            ) {
              const data = payload.data as {
                userId?: string;
                email?: string;
                name?: string;
              };
              await browser.storage.local.set({
                pairedUser: {
                  userId: data.userId,
                  email: data.email,
                  name: data.name,
                },
              });
            }
            sendResponse(payload);
          })
          .catch(() => {
            sendResponse({ ok: false });
          });
        return true;
      }
    }
    sendResponse({ ok: false });
  });

  const api = new SellSimilarApiClient({
    baseUrl: apiBaseUrl,
    fetch: (input, init) => fetch(input, init),
    getHeaders: async () => {
      const stored = await browser.storage.local.get("pairedUser");
      const paired = stored.pairedUser as { userId?: string } | undefined;
      const headers: Record<string, string> = {};
      if (paired?.userId) {
        headers["x-extension-user-id"] = paired.userId;
      }
      return headers;
    },
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isFillItemYesNoRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false, reason: "No tab" } satisfies FillItemYesNoResponse);
        return;
      }
      void browser.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: fillItemYesNoInPage,
          args: [{ key: message.key, value: message.value }],
        })
        .then((injected) => {
          const result = injected[0]?.result;
          sendResponse(result ?? { ok: false, reason: "Yes/No fill script did not run" });
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          } satisfies FillItemYesNoResponse);
        });
      return true;
    }

    if (isFillItemCustomRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false, reason: "No tab" } satisfies FillItemCustomResponse);
        return;
      }
      void browser.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: addCustomItemSpecificInPage,
          args: [{ key: message.key, value: message.value }],
        })
        .then((injected) => {
          const result = injected[0]?.result;
          sendResponse(result ?? { ok: false, reason: "Custom specific script did not run" });
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          } satisfies FillItemCustomResponse);
        });
      return true;
    }

    if (isRestoreListingPageRequest(message)) {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false } satisfies RestoreListingPageResponse);
        return;
      }
      void browser.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: restoreListingPageInPage,
        })
        .then(() => {
          sendResponse({ ok: true } satisfies RestoreListingPageResponse);
        })
        .catch(() => {
          sendResponse({ ok: false } satisfies RestoreListingPageResponse);
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

    if (isReportApplyRequest(message)) {
      void api
        .reportApplyResult({
          jobId: message.jobId,
          fitmentCount: message.fitmentCount,
          imageCount: message.imageCount,
          warningCount: message.warningCount,
          warnings: message.warnings,
        })
        .then((response) => {
          sendResponse(
            response.ok
              ? ({ ok: true } satisfies ReportApplyResponseMessage)
              : ({ ok: false, error: response.error.message } satisfies ReportApplyResponseMessage),
          );
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: apiErrorMessage(error),
          } satisfies ReportApplyResponseMessage);
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
          jobId: response.jobId,
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
