import type { Page } from "puppeteer-core";

/**
 * Resource types that never affect scraping. Fitment, title, specifics and
 * category extraction only read textContent and element attributes, so styling
 * and media are pure download cost — and eBay's listing pages are heavy with
 * both. Scripts, documents and XHR/fetch stay allowed: compatibility
 * pagination clicks real buttons and waits for eBay's JS to re-render rows.
 */
const BLOCKED_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  "image",
  "media",
  "font",
  "stylesheet",
]);

/** Analytics, ads and beacons: requested constantly, never read by the scraper. */
const BLOCKED_URL_PATTERNS: readonly RegExp[] = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /scorecardresearch\.com/i,
  /\/gh\/api\/track/i,
  /ebaystatic\.com\/.*\.(?:css|woff2?|ttf|png|jpe?g|gif|svg)/i,
];

export type BlockedResourceStats = {
  blocked: number;
  allowed: number;
};

/**
 * Abort non-essential requests for the lifetime of the page. Returns a live
 * stats object so callers can log how much was skipped.
 */
export async function blockHeavyResources(page: Page): Promise<BlockedResourceStats> {
  const stats: BlockedResourceStats = { blocked: 0, allowed: 0 };

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const shouldBlock =
      BLOCKED_RESOURCE_TYPES.has(request.resourceType()) ||
      BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(request.url()));

    if (shouldBlock) {
      stats.blocked += 1;
      void request.abort().catch(() => undefined);
      return;
    }

    stats.allowed += 1;
    void request.continue().catch(() => undefined);
  });

  return stats;
}
