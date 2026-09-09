import { fetchEbayListing, prepareListingPage } from "./controllers/FetchEbayListing.js";
import { fetchFitment } from "./controllers/FetchFitment.js";

function emptyListingData() {
  return {
    title: "",
    sku: "",
    price: "",
    images: [],
    itemSpecifics: [],
    category: { id: "", name: "", path: [] },
    storeCategories: [],
    fitment: [],
    compatibility: [],
    compatibilityCount: 0,
  };
}

function applyFitment(listingData, fitmentResult) {
  const compatibility = Array.isArray(fitmentResult?.compatibility)
    ? fitmentResult.compatibility
    : Array.isArray(fitmentResult)
      ? fitmentResult
      : [];

  console.log(`[processListing] 📊 Applying ${compatibility.length} fitment rows`);

  listingData.fitment = compatibility;
  listingData.compatibility = compatibility;
  listingData.compatibilityCount = compatibility.length;

  return listingData;
}

function applyFetchedListing(listingData, fetched) {
  listingData.title = fetched.title;
  listingData.sku = fetched.sku;
  listingData.price = fetched.price;
  listingData.images = fetched.images || [];
  listingData.itemSpecifics = fetched.itemSpecifics || [];
  listingData.category = fetched.category || { id: "", name: "", path: [] };
  listingData.storeCategories = [];
  applyFitment(listingData, fetched);
  return listingData;
}

export async function processListing(page, listingUrl, options = {}) {
  const scrapeMode = options.scrapeMode ?? "full-scrape";
  const listingData = emptyListingData();
  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : async () => {};

  switch (scrapeMode) {
    case "full-scrape": {
      const fetched = await fetchEbayListing(page, listingUrl, options);
      await onProgress("listing_extract");
      applyFetchedListing(listingData, fetched);
      await onProgress("media_extract");
      await onProgress("fitment_extract");
      const fitmentResult = await fetchFitment(page, listingUrl, options);
      applyFitment(listingData, fitmentResult);
      await onProgress("normalize");

      console.log(`[processListing] 📊 Fitment result:`, fitmentResult);
      console.log(`[processListing] 📊 Final listingData compatibility: ${listingData.compatibility.length}`);
      console.log(`[processListing] 📊 First row:`, listingData.compatibility[0]);

      if (!listingData.title) {
        return {
          status: "failed",
          code: "400",
          message: "Unable to fetch listing title",
          listingData,
        };
      }

      return {
        status: "ok",
        code: "200",
        listingData,
      };
    }

    case "only-fitment": {
      await prepareListingPage(page, listingUrl, options);
      const sourceOk = await page.evaluate(() => {
        const text = (document.body?.innerText || "").slice(0, 2500);
        if (/this listing was ended|we looked everywhere|page not found|error 404/i.test(text)) {
          return false;
        }
        return Boolean(
          document.querySelector(
            'h1[data-testid="x-item-title-label"], .x-item-title__mainTitle, h1[itemprop="name"], .motors-compatibility-table, [data-testid="d-motors-compatibility-table"], [data-testid="d-item-compatibility"]',
          ),
        );
      });
      if (!sourceOk) {
        return {
          status: "failed",
          code: "404",
          message: "SOURCE_NOT_FOUND",
          listingData,
        };
      }

      await onProgress("fitment_extract");
      const fitmentResult = await fetchFitment(page, listingUrl, options);
      console.log(`[processListing] 📊 Fitment result:`, fitmentResult);

      applyFitment(listingData, fitmentResult);
      await onProgress("normalize");

      console.log(`[processListing] 📊 Final listingData compatibility: ${listingData.compatibility.length}`);
      console.log(`[processListing] 📊 First row:`, listingData.compatibility[0]);

      return {
        status: "ok",
        code: "200",
        listingData,
      };
    }

    default: {
      const exhaustive = scrapeMode;
      throw new Error(`Unhandled scrape mode: ${String(exhaustive)}`);
    }
  }
}
