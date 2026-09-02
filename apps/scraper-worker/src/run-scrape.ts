import { createBrowser } from "./browser.js";
import { processListing } from "./controllers/ListingsController.js";
import type { ScraperEnv } from "./env.js";

type ScrapeResult = Awaited<ReturnType<typeof processListing>>;

let scrapeQueue: Promise<unknown> = Promise.resolve();

export async function runScrape(
  env: ScraperEnv,
  listingUrl: string,
  options: { html?: string } = {},
): Promise<ScrapeResult> {
  const run = scrapeQueue.then(async () => {
    const browser = await createBrowser(env);
    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      );
      return await processListing(page, listingUrl, options);
    } finally {
      await browser.close();
    }
  });

  scrapeQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}
