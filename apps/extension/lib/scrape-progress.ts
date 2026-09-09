import {
  scrapeProgressPercent,
  type ScrapeProgressStage,
} from "@sell-similar/contracts";

export function progressForStage(stage: ScrapeProgressStage): number {
  return scrapeProgressPercent(stage);
}
