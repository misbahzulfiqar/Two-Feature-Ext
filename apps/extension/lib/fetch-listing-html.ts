import { openListingAndCollectFitment } from "./collect-fitment-pages.ts";
import {
  COLLECT_FITMENT_PAGES,
  type CollectFitmentPagesResponseMessage,
} from "./scrape-messages.ts";

function decodeHref(href: string): string {
  return href.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

function itemIdFromUrl(listingUrl: string): string {
  const match = listingUrl.match(/\/itm\/(\d+)/i);
  return match?.[1] ?? "";
}

function compatibilityVehicleCount(html: string): number {
  const patterns = [
    /compatible with\s+(\d+)\s+vehicle/i,
    /fits\s+(\d+)\s+vehicle/i,
    /(\d+)\s+compatible vehicle/i,
    /(\d+)\s+vehicle\(s\)/i,
    /of\s+(\d+)\s+vehicle/i,
    /this part fits\s+(\d+)/i,
    /see all\s+(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return 0;
}

function toAbsoluteUrl(href: string, listingUrl: string): string | undefined {
  const decoded = decodeHref(href);
  if (!decoded || decoded.startsWith("javascript:") || decoded === "#") {
    return undefined;
  }
  try {
    return new URL(decoded, listingUrl).toString();
  } catch {
    return undefined;
  }
}

export function extraCompatibilityUrls(listingUrl: string, html: string): string[] {
  const urls = new Set<string>();
  const itemId = itemIdFromUrl(listingUrl);
  const patterns = [
    /pagination__(?:item|next)[^>]{0,240}?href=["']([^"']+)["']/gi,
    /href=["']([^"']+)["'][^>]{0,240}?pagination__(?:item|next)/gi,
    /href=["']([^"']*\/pcc\/[^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const absolute = toAbsoluteUrl(match[1] ?? "", listingUrl);
      if (absolute && (/\/itm\//i.test(absolute) || /\/pcc\//i.test(absolute))) {
        urls.add(absolute);
      }
    }
  }

  const count = compatibilityVehicleCount(html);
  const pageCount = count > 20 ? Math.min(40, Math.ceil(count / 20)) : 1;

  if (itemId) {
    if (pageCount > 1) {
      urls.add(`https://www.ebay.com/pcc/${itemId}`);
    }
    for (let page = 2; page <= pageCount; page += 1) {
      const pgn = new URL(listingUrl);
      pgn.searchParams.set("_pgn", String(page));
      urls.add(pgn.toString());

      const pcc = new URL(listingUrl);
      pcc.searchParams.set("pccpage", String(page));
      urls.add(pcc.toString());

      urls.add(`https://www.ebay.com/pcc/${itemId}?page=${page}`);
    }
  }

  return [...urls].filter((url) => {
    try {
      return new URL(url).toString() !== new URL(listingUrl).toString();
    } catch {
      return false;
    }
  });
}

function looksLikeEbayListing(html: string): boolean {
  if (html.length < 1500) return false;
  if (/sorry[\s\S]{0,80}something went wrong on our end/i.test(html)) return false;
  if (/checking your browser|pardon our interruption|captcha/i.test(html)) return false;
  return /x-item-title|itemprop="name"|x-item-condition|ux-labels-values|itm-/i.test(html);
}

async function fetchHtml(
  url: string,
  credentials: RequestCredentials,
): Promise<string> {
  const response = await fetch(url, {
    credentials,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return "";
  }
  return response.text();
}

/**
 * Best-effort source HTML for the worker.
 *
 * eBay commonly answers the first anonymous request with an anti-bot
 * interstitial, then serves the real page once cookies are warm. Returning
 * undefined instead of throwing matters: `html` is optional on the scrape
 * request, and the worker navigates the listing in its own browser anyway, so a
 * blocked fetch here should degrade to a live scrape rather than fail the run.
 */
export async function fetchListingHtml(
  listingUrl: string,
): Promise<string | undefined> {
  const started = Date.now();
  console.log("[SellSimilar] fetching source listing", listingUrl);
  try {
    const session = await fetchHtml(listingUrl, "include");
    console.log(
      "[SellSimilar] source listing fetched",
      `${session.length} chars`,
      `${Date.now() - started}ms`,
      looksLikeEbayListing(session) ? "listing" : "not-a-listing",
    );
    if (looksLikeEbayListing(session) || session.length > 1500) {
      return appendFitmentPages(listingUrl, session);
    }
  } catch (error) {
    console.log(
      "[SellSimilar] source listing fetch failed",
      error instanceof Error ? error.message : error,
    );
  }
  return undefined;
}

function fitmentSlice(html: string): string {
  const index = html.search(
    /motors-compatibility-table|d-motors-compatibility-table|d-item-compatibility|compatible vehicles/i,
  );
  if (index < 0) {
    return "";
  }
  return html.slice(Math.max(0, index - 500), index + 120_000);
}

function vehicleRowTexts(html: string): string[] {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  return rows
    .map((row) => row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((text) => /\b(?:19|20)\d{2}\b/.test(text) && text.length > 8);
}

function compatibilityFragment(html: string): string | undefined {
  const slice = fitmentSlice(html);
  if (!slice || !/<td[\s>]/i.test(slice) || !/year/i.test(slice) || !/make/i.test(slice)) {
    return undefined;
  }
  if (vehicleRowTexts(slice).length === 0) {
    return undefined;
  }
  return slice;
}

function pageUrls(listingUrl: string, itemId: string, page: number, discovered: string[]): string[] {
  const urls: string[] = [];
  for (const discoveredUrl of discovered) {
    try {
      const parsed = new URL(discoveredUrl);
      const pageValue = parsed.searchParams.get("page") ?? parsed.searchParams.get("_pgn") ?? parsed.searchParams.get("pccpage") ?? parsed.searchParams.get("pg");
      if (pageValue === String(page)) {
        urls.push(discoveredUrl);
      }
    } catch {
      // skip a bad href
    }
  }
  const listing = new URL(listingUrl);
  const pgn = new URL(listingUrl);
  pgn.searchParams.set("_pgn", String(page));
  const pccPage = new URL(listingUrl);
  pccPage.searchParams.set("pccpage", String(page));
  urls.push(
    `https://www.ebay.com/pcc/${itemId}?page=${page}`,
    `https://www.ebay.com/pcc/${itemId}?pg=${page}`,
    pgn.toString(),
    pccPage.toString(),
  );
  const unique = [...new Set(urls)].slice(0, 6);
  return unique.filter((url) => {
    try {
      return new URL(url).toString() !== listing.toString();
    } catch {
      return false;
    }
  });
}

async function readNewFitmentPage(
  listingUrl: string,
  itemId: string,
  page: number,
  discovered: string[],
  seenRows: Set<string>,
): Promise<string | undefined> {
  for (const url of pageUrls(listingUrl, itemId, page, discovered)) {
    try {
      const html = await fetchHtml(url, "include");
      const fragment = compatibilityFragment(html);
      if (!fragment) {
        continue;
      }
      const rows = vehicleRowTexts(fragment);
      const fresh = rows.filter((row) => !seenRows.has(row));
      if (fresh.length === 0) {
        continue;
      }
      for (const row of rows) {
        seenRows.add(row);
      }
      console.log("[SellSimilar] fitment page captured", page, fresh.length, url);
      return fragment;
    } catch (error) {
      console.log(
        "[SellSimilar] fitment page failed",
        page,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return undefined;
}

function reportFitmentProgress(page: number, vehicles: number): void {
  console.log(`[SellSimilar] Reading page ${page}, ${vehicles} vehicles`);
  window.dispatchEvent(
    new CustomEvent("sell-similar-fitment-progress", {
      detail: { page, vehicles },
    }),
  );
}

function canOpenTabs(): boolean {
  try {
    return typeof browser.tabs?.create === "function";
  } catch {
    return false;
  }
}

async function collectClickedFitmentPages(listingUrl: string): Promise<string[]> {
  try {
    if (canOpenTabs()) {
      return await openListingAndCollectFitment(listingUrl);
    }
    const response = (await browser.runtime.sendMessage({
      type: COLLECT_FITMENT_PAGES,
      listingUrl,
    })) as CollectFitmentPagesResponseMessage | undefined;
    return Array.isArray(response?.tables) ? response.tables : [];
  } catch (error) {
    console.log(
      "[SellSimilar] fitment page click failed",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function freshTableChunks(tables: string[], seenRows: Set<string>): string[] {
  const chunks: string[] = [];
  for (const table of tables) {
    const rows = vehicleRowTexts(table);
    const fresh = rows.filter((row) => !seenRows.has(row));
    if (fresh.length === 0) {
      continue;
    }
    for (const row of rows) {
      seenRows.add(row);
    }
    chunks.push(table);
  }
  return chunks;
}

/** eBay shows 20 vehicles per page. Later pages are appended for the existing extractor. */
async function appendFitmentPages(listingUrl: string, html: string): Promise<string> {
  const itemId = itemIdFromUrl(listingUrl);
  const section = fitmentSlice(html);
  const firstRows = vehicleRowTexts(section || html);
  const count = Math.max(compatibilityVehicleCount(html), compatibilityVehicleCount(section));
  const hasNext = /pagination__next|go to next compatibility|next page/i.test(section);
  const pageCount =
    count > 20 ? Math.min(40, Math.ceil(count / 20)) : firstRows.length >= 20 || hasNext ? 40 : 1;
  if (!itemId || pageCount <= 1) {
    console.log("[SellSimilar] fitment single page", { count, rows: firstRows.length });
    return html;
  }

  const seenRows = new Set(firstRows);
  const firstPageVehicles = firstRows.length || Math.min(count, 20);
  reportFitmentProgress(1, firstPageVehicles);
  console.log("[SellSimilar] reading all fitment pages", {
    count,
    firstPageRows: firstRows.length,
    pageCount,
  });
  const clicked = await collectClickedFitmentPages(listingUrl);
  console.log("[SellSimilar] fitment tables from listing", clicked.length);
  let chunks = freshTableChunks(clicked, seenRows);
  if (chunks.length === 0) {
    const discovered = extraCompatibilityUrls(listingUrl, html);
    const lastPage = clicked.length > 0 ? 2 : pageCount;
    for (let page = 2; page <= lastPage; page += 1) {
      console.log("[SellSimilar] fitment page", `${page}/${pageCount}`);
      const fragment = await readNewFitmentPage(listingUrl, itemId, page, discovered, seenRows);
      if (!fragment) {
        console.log("[SellSimilar] fitment page empty, stop", page);
        break;
      }
      chunks.push(fragment);
      const pageRows = vehicleRowTexts(fragment).length;
      reportFitmentProgress(page, seenRows.size);
      if (count > 20 && chunks.length + 1 >= pageCount) {
        break;
      }
      if (count <= 20 && pageRows < 20) {
        break;
      }
    }
  }

  console.log("[SellSimilar] fitment extra pages captured", chunks.length, "rows", seenRows.size);
  if (chunks.length === 0) {
    return html;
  }
  return `${html}\n${chunks.map((chunk) => `<!--SELL_SIMILAR_FITMENT_PAGES-->\n${chunk}`).join("\n")}`;
}
