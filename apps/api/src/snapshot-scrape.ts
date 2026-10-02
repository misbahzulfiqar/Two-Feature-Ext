import type { ScrapeMode } from "@sell-similar/contracts";
import { processListing } from "../../scraper-worker/src/processListing.js";
import { createSnapshotPage } from "./html-page.js";

const emptyListing = {
  title: "",
  sku: "",
  price: "",
  images: [],
  itemSpecifics: [],
  condition: "",
  conditionDescription: "",
  description: "",
  category: { id: "", name: "", path: [] },
  storeCategories: [],
  shipping: { service: "", cost: "", handlingTime: "", location: "", details: "" },
  weight: { value: "", unit: "" },
  dimensions: { length: "", width: "", height: "", unit: "", raw: "" },
  fitment: [],
  compatibility: [],
  compatibilityCount: 0,
};

export async function scrapeFromHtml(input: {
  listingUrl: string;
  html?: string;
  scrapeMode?: ScrapeMode;
}) {
  const html = input.html?.trim() ?? "";
  if (!html) {
    return {
      status: "failed",
      code: "400",
      message: "The extension did not send the listing page.",
      listingData: emptyListing,
    };
  }
  console.log(`[snapshot-scrape] parsing ${html.length} chars mode=${input.scrapeMode ?? "full-scrape"}`);
  const result = await processListing(createSnapshotPage(html, input.listingUrl), input.listingUrl, {
    html,
    scrapeMode: input.scrapeMode,
  });
  const imageCount = Array.isArray(result.listingData?.images) ? result.listingData.images.length : 0;
  const categoryName = result.listingData?.category?.name ?? "";
  console.log(`[snapshot-scrape] images=${imageCount} category=${categoryName}`);
  return result;
}
