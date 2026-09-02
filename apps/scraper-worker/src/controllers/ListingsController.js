import { fetchEbayListing } from "./FetchEbayListing.js";
import { fetchFitment } from "./FetchFitment.js";

export function validateListingData(
  listingData,
  catalogueDraftBootstrap = false,
) {
  if (catalogueDraftBootstrap) {
    if (!listingData.sku || !listingData.title) {
      return {
        status: "failed",
        code: "400",
        message: "SKU and title are required for catalogue draft bootstrap",
      };
    }
  } else if (!listingData.sku || !listingData.title || !listingData.price) {
    return {
      status: "failed",
      code: "400",
      message: "SKU, title, and price are required fields",
    };
  }

  return null;
}

export async function processListing(page, listingUrl, options = {}) {
  const scrapeMode = options.scrapeMode ?? "full-scrape";
  const listingData = {
    title: "",
    sku: "",
    price: "",
    images: [],
    itemSpecifics: [],
    category: { id: "", name: "", path: [] },
    storeCategories: [],
    fitment: [],
  };

  switch (scrapeMode) {
    case "full-scrape": {
      const fetched = await fetchEbayListing(page, listingUrl, options);
      listingData.title = fetched.title;
      listingData.sku = fetched.sku;
      listingData.price = fetched.price;
      listingData.images = fetched.images || [];
      listingData.itemSpecifics = fetched.itemSpecifics || [];
      listingData.category = fetched.category || { id: "", name: "", path: [] };
      listingData.storeCategories = fetched.storeCategories || [];

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
      listingData.fitment = await fetchFitment(page, listingUrl);
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
