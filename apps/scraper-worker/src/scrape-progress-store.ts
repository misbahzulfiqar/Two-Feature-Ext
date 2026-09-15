import type { ScrapeProgressStage } from "@sell-similar/contracts";

/**
 * Live progress for the scrape currently running over HTTP.
 *
 * The synchronous /scrape call blocks until the whole listing is done, so the
 * extension has no way to see that the worker is, say, on page 4 of the
 * compatibility table. MVP uses short-interval HTTP polling of GET
 * /scrape/progress rather than a persistent WebSocket.
 *
 * A single slot is enough: runScrape serialises scrapes, so at most one is in
 * flight at a time.
 */
export type ScrapeProgressSnapshot = {
  active: boolean;
  listingUrl: string;
  stage: ScrapeProgressStage | null;
  message: string;
  fitmentPage: number;
  fitmentRows: number;
  startedAt: number | null;
  updatedAt: number;
};

function idle(): ScrapeProgressSnapshot {
  return {
    active: false,
    listingUrl: "",
    stage: null,
    message: "",
    fitmentPage: 0,
    fitmentRows: 0,
    startedAt: null,
    updatedAt: Date.now(),
  };
}

let current: ScrapeProgressSnapshot = idle();

const STAGE_MESSAGES: Record<ScrapeProgressStage, string> = {
  queued: "Waiting for an available worker",
  worker_start: "Starting the scraper",
  source_load: "Opening the eBay listing",
  listing_extract: "Reading title, photos and item specifics",
  fitment_extract: "Reading vehicle compatibility",
  media_extract: "Collecting photos",
  normalize: "Normalizing the scraped listing",
  target_prepare: "Preparing the listing editor",
  apply_core: "Filling the listing editor",
  apply_fitment_media: "Applying compatibility and photos",
  complete: "Scrape complete",
};

export function beginScrape(listingUrl: string): void {
  current = {
    ...idle(),
    active: true,
    listingUrl,
    startedAt: Date.now(),
  };
}

export function setScrapeStage(stage: ScrapeProgressStage): void {
  current = {
    ...current,
    active: true,
    stage,
    message: STAGE_MESSAGES[stage] ?? current.message,
    updatedAt: Date.now(),
  };
}

/** Per-page reporting while paging through the compatibility table. */
export function setFitmentProgress(page: number, rows: number, message: string): void {
  current = {
    ...current,
    active: true,
    stage: "fitment_extract",
    fitmentPage: page,
    fitmentRows: rows,
    message: message || `Reading vehicle compatibility, page ${page} (${rows} so far)`,
    updatedAt: Date.now(),
  };
}

export function endScrape(): void {
  current = { ...current, active: false, updatedAt: Date.now() };
}

export function readScrapeProgress(): ScrapeProgressSnapshot {
  return current;
}
