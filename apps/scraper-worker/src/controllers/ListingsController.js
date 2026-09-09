export { processListing } from "../processListing.js";

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
