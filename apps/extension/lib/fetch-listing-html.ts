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
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    return "";
  }
  return response.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  const anonymous = await fetchHtml(listingUrl, "omit");
  if (looksLikeEbayListing(anonymous)) {
    return anonymous;
  }

  // Retry with the user's eBay session, which usually clears the interstitial.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await sleep(700);
    }
    const session = await fetchHtml(listingUrl, "include");
    if (looksLikeEbayListing(session)) {
      return session;
    }
  }

  console.warn(
    "[SellSimilar] could not fetch source HTML (eBay interstitial?); falling back to a live scrape by the worker",
  );
  return undefined;
}
