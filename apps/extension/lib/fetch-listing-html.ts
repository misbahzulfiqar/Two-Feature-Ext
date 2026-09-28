import { type CollectedFitmentPages } from "./collect-fitment-pages.ts";
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
  options?: { fitmentPages?: boolean },
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
      if (options?.fitmentPages === false) {
        return session;
      }
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

type FitmentRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

function parseFitmentRows(html: string): FitmentRow[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows: FitmentRow[] = [];
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(tr.querySelectorAll("td")).map((cell) =>
        (cell.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
      );
      if (cells.length < 3 || !cells[0] || !cells[1] || !cells[2]) {
        continue;
      }
      if (!/\b(?:19|20)\d{2}\b/.test(cells[0])) {
        continue;
      }
      rows.push({
        year: cells[0],
        make: cells[1],
        model: cells[2],
        trim: cells[3] || "",
        engine: cells[4] || "",
        notes: cells[5] || "",
      });
    }
  }
  return rows;
}

function embedFitmentRows(rows: FitmentRow[]): string {
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
    )
    .join("");
  const json = JSON.stringify(rows).replace(/</g, "\\u003c");
  return `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${json}</script>`;
}

function embeddedFitmentCount(html: string): number {
  let total = 0;
  for (const match of html.matchAll(
    /<script type="application\/json" id="sell-similar-fitment-page">([\s\S]*?)<\/script>/g,
  )) {
    try {
      const parsed = JSON.parse(match[1] ?? "[]") as unknown;
      if (Array.isArray(parsed)) {
        total += parsed.length;
      }
    } catch {
      // Ignore a page whose JSON did not parse.
    }
  }
  return total;
}

function reportFitmentProgress(page: number, vehicles: number, message?: string): void {
  const text = message || `Reading page ${page}, ${vehicles} vehicles`;
  console.log(`[SellSimilar] ${text}`);
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("sell-similar-fitment-progress", {
      detail: { page, vehicles, message: text },
    }),
  );
}

async function collectClickedFitmentPages(
  listingUrl: string,
  expectedCount: number,
): Promise<CollectedFitmentPages> {
  const empty: CollectedFitmentPages = { tables: [], advertised: 0, vehicles: 0 };
  try {
    const response = (await browser.runtime.sendMessage({
      type: COLLECT_FITMENT_PAGES,
      listingUrl,
      expectedCount,
    })) as CollectFitmentPagesResponseMessage | undefined;
    return {
      tables: Array.isArray(response?.tables) ? response.tables : [],
      advertised: Number(response?.advertised) || 0,
      vehicles: Number(response?.vehicles) || 0,
    };
  } catch (error) {
    console.log(
      "[SellSimilar] fitment page read failed",
      error instanceof Error ? error.message : error,
    );
    return empty;
  }
}

/** eBay shows 20 vehicles per page. Later pages are appended for the existing extractor. */
async function appendFitmentPages(listingUrl: string, html: string): Promise<string> {
  const itemId = itemIdFromUrl(listingUrl);
  if (!itemId) {
    return html;
  }
  const section = fitmentSlice(html);
  const firstRows = vehicleRowTexts(section || html);
  const count = Math.max(compatibilityVehicleCount(html), compatibilityVehicleCount(section));
  console.log("[SellSimilar] reading all fitment pages", {
    count,
    firstPageRows: firstRows.length,
    pageCount: count > 20 ? Math.ceil(count / 20) : 1,
  });
  const clicked = await collectClickedFitmentPages(listingUrl, count);
  console.log("[SellSimilar] fitment tables from listing", clicked.tables.length, clicked.vehicles);
  const chunks = clicked.tables.filter((table) => table.includes("sell-similar-fitment-page"));
  const clickedVehicles =
    clicked.vehicles || chunks.reduce((total, table) => total + embeddedFitmentCount(table), 0);
  console.log("[SellSimilar] fitment extra pages captured", chunks.length, "rows", clickedVehicles);
  if (count > 20 && clickedVehicles <= Math.max(firstRows.length, 20)) {
    throw new Error(
      `Read ${clickedVehicles || firstRows.length} of ${count} compatible vehicles. The next compatibility page did not open.`,
    );
  }
  if (chunks.length === 0) {
    return html;
  }
  return `${html}\n${chunks.map((chunk) => `<!--SELL_SIMILAR_FITMENT_PAGES-->\n${chunk}`).join("\n")}`;
}
