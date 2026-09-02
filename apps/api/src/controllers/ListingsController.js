import { sellSimilarRequestSchema } from "@sell-similar/validation";

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

export function createListing(req, res) {
  const listingData = req.body?.listingData ?? req.body ?? {};
  const catalogueDraftBootstrap = Boolean(req.body?.catalogueDraftBootstrap);
  const error = validateListingData(listingData, catalogueDraftBootstrap);

  if (error) {
    return res.status(400).send(error);
  }

  return res.status(501).send({
    status: "failed",
    code: "501",
    message: "Listing create is not implemented yet",
  });
}

export function sellSimilar(req, res) {
  const parsed = sellSimilarRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: parsed.error.message },
      correlationId: req.correlationId,
    });
  }

  const listingData = req.body?.listingData;
  if (listingData) {
    const error = validateListingData(
      listingData,
      Boolean(req.body?.catalogueDraftBootstrap),
    );
    if (error) {
      return res.status(400).send(error);
    }
  }

  return res.status(501).json({
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Sell Similar lookup is not implemented yet",
    },
    correlationId: req.correlationId,
  });
}
