import {
  scrapeListingRequestSchema,
  scrapedListingDataSchema,
  sellSimilarRequestSchema,
} from "@sell-similar/validation";

const SCRAPE_TIMEOUT_MS = 120_000;

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

export function createScrapeListingHandler(scraperWorkerUrl) {
  const workerBaseUrl = String(scraperWorkerUrl).replace(/\/+$/, "");

  return async function scrapeListing(req, res) {
    const parsed = scrapeListingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: parsed.error.message },
        correlationId: req.correlationId,
      });
    }

    try {
      const workerResponse = await fetch(`${workerBaseUrl}/scrape`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-correlation-id": req.correlationId,
        },
        body: JSON.stringify({
          listingUrl: parsed.data.listingUrl,
          html: parsed.data.html,
        }),
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      });

      const payload = await workerResponse.json();
      if (!workerResponse.ok || payload?.status !== "ok") {
        return res.status(Number(payload?.code) || workerResponse.status || 502).json({
          ok: false,
          error: {
            code: "SCRAPE_FAILED",
            message: payload?.message || "Scraper worker failed to scrape listing",
          },
          correlationId: req.correlationId,
        });
      }

      const listingData = scrapedListingDataSchema.safeParse(payload.listingData);
      if (!listingData.success) {
        return res.status(502).json({
          ok: false,
          error: {
            code: "INVALID_SCRAPE_RESULT",
            message: "Scraper worker returned invalid listing data",
          },
          correlationId: req.correlationId,
        });
      }

      return res.status(200).json({
        ok: true,
        data: listingData.data,
        correlationId: req.correlationId,
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: {
          code: "SCRAPER_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Could not reach scraper worker",
        },
        correlationId: req.correlationId,
      });
    }
  };
}
