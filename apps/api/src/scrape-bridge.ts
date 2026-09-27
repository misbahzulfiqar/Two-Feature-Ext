import type { ScrapeMode } from "@sell-similar/contracts";
import { runScrape } from "@sell-similar/scraper-worker/run";
import {
  beginScrape,
  endScrape,
  readScrapeProgress,
  setFitmentProgress,
  setScrapeStage,
} from "@sell-similar/scraper-worker/progress";

/** On Vercel the scraper runs inside this API. Locally it stays a separate process. */
export function scraperRunsInApi(): boolean {
  return Boolean(process.env.VERCEL);
}

export function readInProcessScrapeProgress() {
  return readScrapeProgress();
}

function nodeEnv(): "development" | "test" | "production" {
  switch (process.env.NODE_ENV) {
    case "production":
    case "test":
    case "development":
      return process.env.NODE_ENV;
    default:
      return "development";
  }
}

export async function scrapeListingInProcess(input: {
  listingUrl: string;
  html?: string;
  scrapeMode?: ScrapeMode;
}) {
  beginScrape(input.listingUrl);
  try {
    return await runScrape(
      {
        NODE_ENV: nodeEnv(),
        LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
        SCRAPER_WORKER_PORT: 3003,
      },
      input.listingUrl,
      {
        html: input.html,
        scrapeMode: input.scrapeMode,
        onProgress: (stage) => {
          setScrapeStage(stage);
        },
        onFitmentProgress: (page, rows, message) => {
          setFitmentProgress(page, rows, message);
        },
      },
    );
  } finally {
    endScrape();
  }
}
