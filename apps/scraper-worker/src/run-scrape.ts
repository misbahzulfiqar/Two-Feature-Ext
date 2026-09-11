import type { ScrapeMode, ScrapeProgressStage } from "@sell-similar/contracts";
import { withPage } from "./browser-pool.js";
import { processListing } from "./processListing.js";
import type { ScraperEnv } from "./env.js";

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
