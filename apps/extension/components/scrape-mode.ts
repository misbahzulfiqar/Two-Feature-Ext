export const SCRAPE_MODES = ["full-scrape", "only-fitment"] as const;

export type ScrapeMode = (typeof SCRAPE_MODES)[number];

export function isScrapeMode(value: string): value is ScrapeMode {
  return (SCRAPE_MODES as readonly string[]).includes(value);
}

export function scrapeModeLabel(mode: ScrapeMode): string {
  switch (mode) {
    case "full-scrape":
      return "Full Scrape";
    case "only-fitment":
      return "Only fitment";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
