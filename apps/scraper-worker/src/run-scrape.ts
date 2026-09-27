import type { ScrapeMode, ScrapeProgressStage } from "@sell-similar/contracts";
import type { ScraperEnv } from "./env.js";
import { createSnapshotPage } from "./html-page.js";
import { processListing } from "./processListing.js";

type ScrapeResult = Awaited<ReturnType<typeof processListing>>;

export type RunScrapeOptions = {
  html?: string;
  scrapeMode?: ScrapeMode;
  onProgress?: (stage: ScrapeProgressStage) => void | Promise<void>;
  /** Called once per compatibility page; forwarded to fetchFitment. */
  onFitmentProgress?: (
    page: number,
    rows: number,
    message: string,
  ) => void | Promise<void>;
};

let scrapeQueue: Promise<unknown> = Promise.resolve();

export async function runScrape(
  env: ScraperEnv,
  listingUrl: string,
  options: RunScrapeOptions = {},
): Promise<ScrapeResult> {
  const run = scrapeQueue.then(async () => {
    const startedAt = Date.now();
    const html = options.html?.trim() ?? "";
    if (process.env.VERCEL && html) {
      try {
        await options.onProgress?.("source_load");
        return await processListing(createSnapshotPage(html, listingUrl), listingUrl, options);
      } finally {
        console.log(`[runScrape] finished from extension HTML in ${Date.now() - startedAt}ms`);
      }
    }

    // Chrome is loaded only for a local worker. On Vercel this import pulls a
    // browser download that fails with "fetch failed".
    const { withPage } = await import("./browser-pool.js");
    return withPage(env, async (page, resourceStats) => {
      try {
        await options.onProgress?.("source_load");
        return await processListing(page, listingUrl, options);
      } finally {
        console.log(
          `[runScrape] finished in ${Date.now() - startedAt}ms | requests allowed=${resourceStats.allowed} blocked=${resourceStats.blocked}`,
        );
      }
    });
  });

  scrapeQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}
