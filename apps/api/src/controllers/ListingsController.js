import {
  clearScrapeCacheRequestSchema,
  scrapeListingRequestSchema,
  scrapedListingDataSchema,
  sellSimilarRequestSchema,
} from "@sell-similar/validation";
import {
  SCRAPE_CACHE_TTL_MS,
  clearScrapeCache,
  readScrapeCache,
  scrapeCacheBackend,
  scrapeCacheItemId,
  writeScrapeCache,
} from "../scrape-cache.js";

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

/** Proxies worker GET /scrape/progress for the panel's short-interval HTTP poll. */
export function createScrapeProgressHandler(scraperWorkerUrl) {
  const workerBaseUrl = String(scraperWorkerUrl).replace(/[/]+$/, "");

  return async function scrapeProgress(req, res) {
    try {
      const response = await fetch(`${workerBaseUrl}/scrape/progress`, {
        signal: AbortSignal.timeout(4000),
      });
      const payload = await response.json();
      return res.status(200).json({
        ok: true,
        data: payload,
        correlationId: req.correlationId,
      });
    } catch {
      // Progress is best-effort; never fail the caller over it.
      return res.status(200).json({
        ok: true,
        data: { active: false, stage: null, message: "" },
        correlationId: req.correlationId,
      });
    }
  };
}

export async function clearScrapeCacheHandler(req, res) {
  const parsed = clearScrapeCacheRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: parsed.error.message },
      correlationId: req.correlationId,
    });
  }

  const ebayItemId = scrapeCacheItemId(parsed.data.listingUrl);
  const cleared = await clearScrapeCache(parsed.data.listingUrl);
  console.log(`[scrape] cache CLEAR ${ebayItemId} removed=${cleared}`);

  return res.status(200).json({
    ok: true,
    data: { ebayItemId, cleared },
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

    const scrapeMode = parsed.data.scrapeMode ?? "full-scrape";

    if (!parsed.data.refresh) {
      const cached = await readScrapeCache(parsed.data.listingUrl, scrapeMode);
      if (cached) {
        console.log(
          `[scrape] cache HIT (${cached.backend}) ${scrapeCacheItemId(parsed.data.listingUrl)} mode=${scrapeMode} age=${Math.round(cached.ageMs / 1000)}s`,
        );
        return res.status(200).json({
          ok: true,
          data: cached.data,
          cache: {
            hit: true,
            ageMs: cached.ageMs,
            ttlMs: SCRAPE_CACHE_TTL_MS,
            backend: cached.backend,
          },
          correlationId: req.correlationId,
        });
      }
    }

    console.log(
      `[scrape] cache ${parsed.data.refresh ? "BYPASS" : "MISS"} ${scrapeCacheItemId(parsed.data.listingUrl)} mode=${scrapeMode}`,
    );

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
          scrapeMode: parsed.data.scrapeMode,
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

      await writeScrapeCache(parsed.data.listingUrl, scrapeMode, listingData.data);

      return res.status(200).json({
        ok: true,
        data: listingData.data,
        cache: {
          hit: false,
          ageMs: 0,
          ttlMs: SCRAPE_CACHE_TTL_MS,
          backend: scrapeCacheBackend(),
        },
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
