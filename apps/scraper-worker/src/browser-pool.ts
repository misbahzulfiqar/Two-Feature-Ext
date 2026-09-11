import type { Browser, Page } from "puppeteer-core";
import { blockHeavyResources, type BlockedResourceStats } from "./block-resources.js";
import { createBrowser } from "./browser.js";
import type { ScraperEnv } from "./env.js";

/**
 * Chrome takes seconds to start, and the previous code paid that on every
 * scrape. The browser is kept alive between scrapes instead, which also keeps
 * eBay cookies warm across runs.
 *
 * Reuse is only safe with real lifecycle handling, so this module covers:
 *   - lazy launch, with concurrent callers sharing one launch
 *   - detecting a browser that died or was killed externally, and relaunching
 *   - retrying a scrape once on a crash that looks like a dead browser/page
 *   - always closing the page, so a long-lived browser does not leak tabs
 *   - closing the browser after an idle period to release memory
 *   - killing Chrome on process exit so no orphan survives the worker
 */
const IDLE_SHUTDOWN_MS = 5 * 60_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let browser: Browser | undefined;
let launching: Promise<Browser> | undefined;
let idleTimer: NodeJS.Timeout | undefined;
let activePages = 0;
let shutdownHooksInstalled = false;

/** puppeteer-core exposes `connected`; older builds only had `isConnected()`. */
function isConnected(candidate: Browser): boolean {
  const probe = candidate as unknown as {
    connected?: boolean;
    isConnected?: () => boolean;
  };
  if (typeof probe.connected === "boolean") {
    return probe.connected;
  }
  if (typeof probe.isConnected === "function") {
    return probe.isConnected();
  }
  return false;
}

function installShutdownHooks(): void {
  if (shutdownHooksInstalled) {
    return;
  }
  shutdownHooksInstalled = true;

  // Synchronous last resort: 'exit' cannot await, so kill the process directly.
  process.once("exit", () => {
    try {
      browser?.process()?.kill();
    } catch {
      // process may already be gone
    }
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void closeBrowser(signal).finally(() => {
        process.exit(0);
      });
    });
  }
}

function cancelIdleShutdown(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
}

function scheduleIdleShutdown(): void {
  cancelIdleShutdown();
  if (activePages > 0) {
    return;
  }
  idleTimer = setTimeout(() => {
    void closeBrowser("idle timeout");
  }, IDLE_SHUTDOWN_MS);
  // Never hold the process open just for the idle timer.
  idleTimer.unref?.();
}

async function getBrowser(env: ScraperEnv): Promise<Browser> {
  if (browser && isConnected(browser)) {
    return browser;
  }
  if (launching) {
    return launching;
  }

  installShutdownHooks();

  const pending = (async () => {
    const launched = await createBrowser(env);
    launched.once("disconnected", () => {
      if (browser === launched) {
        browser = undefined;
        console.log("[browser-pool] browser disconnected; will relaunch on next scrape");
      }
    });
    console.log("[browser-pool] launched Chrome");
    return launched;
  })();

  launching = pending;
  try {
    browser = await pending;
    return browser;
  } finally {
    launching = undefined;
  }
}

export async function closeBrowser(reason: string): Promise<void> {
  cancelIdleShutdown();
  const current = browser;
  browser = undefined;
  if (!current) {
    return;
  }
  console.log(`[browser-pool] closing Chrome (${reason})`);
  try {
    await current.close();
  } catch {
    try {
      current.process()?.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

/**
 * Errors that mean the browser or tab died underneath us. A fresh browser is
 * likely to succeed, so these are retried once.
 */
function isRecoverable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /target closed|session closed|protocol error|connection closed|browser has disconnected|websocket is not open|target crashed|page crashed/i.test(
    message,
  );
}

async function attempt<T>(
  env: ScraperEnv,
  run: (page: Page, stats: BlockedResourceStats) => Promise<T>,
): Promise<T> {
  const active = await getBrowser(env);
  const page = await active.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    const stats = await blockHeavyResources(page);
    return await run(page, stats);
  } finally {
    // Never let a page-close failure mask the real error.
    await page.close({ runBeforeUnload: false }).catch(() => undefined);
  }
}

/**
 * Run one scrape on a pooled browser. The page is always closed; the browser
 * survives for the next call unless it died or went idle.
 */
export async function withPage<T>(
  env: ScraperEnv,
  run: (page: Page, stats: BlockedResourceStats) => Promise<T>,
): Promise<T> {
  activePages += 1;
  cancelIdleShutdown();
  try {
    try {
      return await attempt(env, run);
    } catch (error) {
      if (!isRecoverable(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[browser-pool] recovering from "${message}"; relaunching Chrome`);
      await closeBrowser("recovery");
      return await attempt(env, run);
    }
  } finally {
    activePages -= 1;
    scheduleIdleShutdown();
  }
}

/** Exposed for diagnostics and tests. */
export function browserPoolStatus(): {
  running: boolean;
  activePages: number;
  idleShutdownMs: number;
} {
  return {
    running: Boolean(browser && isConnected(browser)),
    activePages,
    idleShutdownMs: IDLE_SHUTDOWN_MS,
  };
}
