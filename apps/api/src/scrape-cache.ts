import {
  SCRAPE_MODES,
  ebayItemIdFromListingUrl,
  type ScrapeMode,
  type ScrapedListingData,
} from "@sell-similar/contracts";
import { Redis } from "ioredis";

/**
 * Scraping a listing costs a browser page load plus several eBay round trips,
 * so a repeat request for the same item within a few minutes is pure waste.
 * Entries are keyed by eBay item ID *and* scrape mode, because "full-scrape"
 * and "only-fitment" return different data for the same item.
 *
 * Redis is used when REDIS_URL is configured and reachable, so multiple API
 * instances share one cache. Redis being unavailable is never fatal: the store
 * falls back to an in-process Map, and any runtime Redis error demotes the
 * backend to memory rather than failing the request.
 */
export const SCRAPE_CACHE_TTL_MS = 5 * 60_000;

const REDIS_KEY_PREFIX = "sell-similar:scrape-cache";

export type ScrapeCacheBackend = "redis" | "memory";

type MemoryEntry = {
  data: ScrapedListingData;
  storedAt: number;
};

const memory = new Map<string, MemoryEntry>();

let redis: Redis | undefined;
let backend: ScrapeCacheBackend = "memory";

/** eBay item ID when the input has one; otherwise the normalized input. */
export function scrapeCacheItemId(listingUrlOrId: string): string {
  const raw = String(listingUrlOrId ?? "").trim();
  const fromUrl = ebayItemIdFromListingUrl(raw);
  if (fromUrl) {
    return fromUrl;
  }
  if (/^\d{6,}$/.test(raw)) {
    return raw;
  }
  return raw.toLowerCase();
}

function memoryKey(listingUrlOrId: string, scrapeMode: ScrapeMode): string {
  return `${scrapeCacheItemId(listingUrlOrId)}|${scrapeMode}`;
}

function redisKey(listingUrlOrId: string, scrapeMode: ScrapeMode): string {
  return `${REDIS_KEY_PREFIX}:${scrapeCacheItemId(listingUrlOrId)}:${scrapeMode}`;
}

export function scrapeCacheBackend(): ScrapeCacheBackend {
  return backend;
}

/** Demote to the in-memory map after a Redis failure; requests keep working. */
function demoteToMemory(operation: string, error: unknown): void {
  if (backend === "redis") {
    backend = "memory";
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[scrape-cache] Redis ${operation} failed (${message}); falling back to in-memory cache`,
    );
  }
}

/**
 * Connect the cache to Redis when configured. Safe to call with undefined, and
 * safe to call when Redis is down — it resolves to the memory backend instead
 * of throwing, so the API always starts.
 */
export async function configureScrapeCache(redisUrl?: string): Promise<ScrapeCacheBackend> {
  if (!redisUrl) {
    backend = "memory";
    console.log("[scrape-cache] REDIS_URL not set; using in-memory cache");
    return backend;
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  // Without a listener ioredis treats connection errors as unhandled.
  client.on("error", () => undefined);

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") {
      throw new Error(`unexpected PING reply: ${pong}`);
    }
    redis = client;
    backend = "redis";
    console.log("[scrape-cache] using Redis cache");
    // A later disconnect must not strand us on a dead client.
    client.on("end", () => {
      if (backend === "redis") {
        backend = "memory";
        console.warn("[scrape-cache] Redis connection ended; falling back to in-memory cache");
      }
    });
    client.on("ready", () => {
      if (redis === client) {
        backend = "redis";
        console.log("[scrape-cache] Redis connection restored");
      }
    });
    return backend;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[scrape-cache] could not reach Redis (${message}); using in-memory cache`,
    );
    client.disconnect();
    redis = undefined;
    backend = "memory";
    return backend;
  }
}

/** Test seam: drop the Redis client and return to the memory backend. */
export async function resetScrapeCache(): Promise<void> {
  memory.clear();
  if (redis) {
    redis.disconnect();
    redis = undefined;
  }
  backend = "memory";
}

function dropExpiredMemory(now: number): void {
  for (const [key, entry] of memory) {
    if (now - entry.storedAt >= SCRAPE_CACHE_TTL_MS) {
      memory.delete(key);
    }
  }
}

export type CachedScrape = {
  data: ScrapedListingData;
  ageMs: number;
  backend: ScrapeCacheBackend;
};

export async function readScrapeCache(
  listingUrl: string,
  scrapeMode: ScrapeMode,
): Promise<CachedScrape | null> {
  if (redis && backend === "redis") {
    try {
      const raw = await redis.get(redisKey(listingUrl, scrapeMode));
      if (raw) {
        const parsed = JSON.parse(raw) as { data: ScrapedListingData; storedAt: number };
        return {
          data: parsed.data,
          ageMs: Math.max(0, Date.now() - parsed.storedAt),
          backend: "redis",
        };
      }
      return null;
    } catch (error) {
      demoteToMemory("GET", error);
      // fall through to memory
    }
  }

  const now = Date.now();
  dropExpiredMemory(now);
  const entry = memory.get(memoryKey(listingUrl, scrapeMode));
  if (!entry) {
    return null;
  }
  return { data: entry.data, ageMs: now - entry.storedAt, backend: "memory" };
}

export async function writeScrapeCache(
  listingUrl: string,
  scrapeMode: ScrapeMode,
  data: ScrapedListingData,
): Promise<void> {
  const storedAt = Date.now();

  if (redis && backend === "redis") {
    try {
      await redis.set(
        redisKey(listingUrl, scrapeMode),
        JSON.stringify({ data, storedAt }),
        "PX",
        SCRAPE_CACHE_TTL_MS,
      );
      return;
    } catch (error) {
      demoteToMemory("SET", error);
    }
  }

  memory.set(memoryKey(listingUrl, scrapeMode), { data, storedAt });
}

/**
 * Clear every cached mode for one item. Returns how many entries were removed
 * so the caller can tell the user whether anything was actually cached.
 */
export async function clearScrapeCache(listingUrlOrId: string): Promise<number> {
  let cleared = 0;

  if (redis && backend === "redis") {
    try {
      const keys = SCRAPE_MODES.map((mode) => redisKey(listingUrlOrId, mode));
      cleared = await redis.del(...keys);
    } catch (error) {
      demoteToMemory("DEL", error);
    }
  }

  dropExpiredMemory(Date.now());
  const prefix = `${scrapeCacheItemId(listingUrlOrId)}|`;
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) {
      memory.delete(key);
      cleared += 1;
    }
  }

  return cleared;
}

export async function scrapeCacheSize(): Promise<number> {
  dropExpiredMemory(Date.now());
  return memory.size;
}
