import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { scrapeListingRequestSchema } from "@sell-similar/validation";
import type { AppLogger } from "@sell-similar/logging";
import type { ScraperEnv } from "./env.js";
import { runScrape } from "./run-scrape.js";
import {
  beginScrape,
  endScrape,
  readScrapeProgress,
  setFitmentProgress,
  setScrapeStage,
} from "./scrape-progress-store.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requestPath(req: IncomingMessage): string {
  const url = req.url ?? "/";
  return url.split("?")[0] ?? "/";
}

export function startScrapeHttpServer(
  env: ScraperEnv,
  logger: AppLogger,
): void {
  const server = createServer((req, res) => {
    void handleRequest(env, logger, req, res);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      logger.error(
        { port: env.SCRAPER_WORKER_PORT },
        "scraper-worker is already running on this port. Keep the existing process and do not start a second one.",
      );
      process.exit(1);
    }
    throw error;
  });

  server.listen(env.SCRAPER_WORKER_PORT, () => {
    logger.info({ port: env.SCRAPER_WORKER_PORT }, "scraper-worker HTTP listening");
  });
}

async function handleRequest(
  env: ScraperEnv,
  logger: AppLogger,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const path = requestPath(req);

  if (req.method === "GET" && path === "/health") {
    sendJson(res, 200, { ok: true, service: "scraper-worker" });
    return;
  }

  // Short-interval HTTP poll from the panel while POST /scrape is in flight.
  // MVP does not use a persistent WebSocket for scrape progress.
  if (req.method === "GET" && path === "/scrape/progress") {
    sendJson(res, 200, readScrapeProgress());
    return;
  }

  if (req.method !== "POST" || path !== "/scrape") {
    sendJson(res, 404, { status: "failed", code: "404", message: "Not found" });
    return;
  }

  try {
    const parsed = scrapeListingRequestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      sendJson(res, 400, {
        status: "failed",
        code: "400",
        message: parsed.error.message,
      });
      return;
    }

    logger.info(
      { listingUrl: parsed.data.listingUrl, hasHtml: Boolean(parsed.data.html) },
      "HTTP scrape received",
    );
    beginScrape(parsed.data.listingUrl);
    let result;
    try {
      result = await runScrape(env, parsed.data.listingUrl, {
        html: parsed.data.html,
        scrapeMode: parsed.data.scrapeMode,
        onProgress: (stage) => {
          setScrapeStage(stage);
        },
        onFitmentProgress: (page, rows, message) => {
          setFitmentProgress(page, rows, message);
        },
      });
    } finally {
      endScrape();
    }
    const listingData = result.listingData;
    logger.info(
      {
        status: result.status,
        scrapeMode: parsed.data.scrapeMode ?? "full-scrape",
        title: listingData?.title,
        images: listingData?.images?.length ?? 0,
        itemSpecifics: listingData?.itemSpecifics?.length ?? 0,
        category: listingData?.category?.name,
        compatibility: listingData?.compatibilityCount ?? listingData?.compatibility?.length ?? 0,
      },
      "HTTP scrape finished",
    );

    if (result.status !== "ok") {
      sendJson(res, Number(result.code) || 400, result);
      return;
    }

    sendJson(res, 200, result);
  } catch (error) {
    logger.error({ error }, "HTTP scrape failed");
    sendJson(res, 500, {
      status: "failed",
      code: "500",
      message: error instanceof Error ? error.message : "Scrape failed",
    });
  }
}
