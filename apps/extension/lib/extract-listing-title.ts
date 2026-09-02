export const PARSER_SELECTORS = {
  title: [
    'h1[data-testid="x-item-title-label"]',
    'h1[id="x-item-title-label"]',
    "h1.it-ttl",
    ".x-item-title-label",
    "#viTabs_0_is h1",
    'h1[class*="x-item-title"]',
    'h1[class*="it-ttl"]',
    "#ebay-item-title",
    'h1[class*="motors-title"]',
    "h1.x-item-title",
    "h1.x-item-title__mainTitle",
    'h1[itemprop="name"]',
  ],
};

function decodeHtmlEntities(text: string): string {
  const decoder = document.createElement("textarea");
  let decoded = text;
  for (let i = 0; i < 3; i += 1) {
    decoder.innerHTML = decoded;
    if (decoder.value === decoded) {
      break;
    }
    decoded = decoder.value;
  }
  return decoded;
}

function stripHtmlFromTitle(text: string): string {
  return text
    .replace(/<\s*wbr\s*\/?\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/?[^>]+>/g, "");
}

function normalizeTitle(text: string): string {
  return stripHtmlFromTitle(decodeHtmlEntities(text))
    .replace(/^\s*Details about\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getText(el: Element | null): string {
  return normalizeTitle(el?.textContent ?? "");
}

const REJECTED_TITLE_PATTERNS = [
  /^Was\s+US?\s?\$/i,
  /^\d+\.\d+\s*in/i,
  /best offer/i,
  /buy it now/i,
  /popular categories from this store/i,
  /detailed seller ratings/i,
  /shop by category/i,
  /about this seller/i,
  /^seller information$/i,
  /^feedback$/i,
  /items for sale/i,
  /people who viewed this/i,
  /similar sponsored items/i,
];

function isRejectedTitle(text: string): boolean {
  const value = text.trim();
  if (value.length < 8) {
    return true;
  }
  return REJECTED_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}

function getLdProduct(doc: Document): { name?: unknown; ["@type"]?: unknown } | null {
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of ldScripts) {
    const raw = script.textContent || "";
    if (!raw.trim()) continue;

    try {
      const data: unknown = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as { name?: unknown; ["@type"]?: unknown };
        const type = record["@type"];
        const isProduct =
          type === "Product" ||
          (Array.isArray(type) && type.includes("Product"));

        if (isProduct) {
          return record;
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  return null;
}

function findTitle(doc: Document): string | null {
  const selectors = [
    'h1[data-testid="x-item-title-label"]',
    "#x-item-title-label",
    ".x-item-title__mainTitle",
    "h1.x-item-title__mainTitle",
    'h1[itemprop="name"]',
    "#itemTitle",
    ".vim.x-item-title h1",
    'h1[data-testid="title"]',
  ];

  for (const selector of selectors) {
    const text = getText(doc.querySelector(selector));
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  const ld = getLdProduct(doc);
  if (ld?.name) {
    const text = normalizeTitle(String(ld.name));
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  const docTitle = normalizeTitle((doc.title || "").replace(/\s*\|\s*eBay.*$/i, ""));
  if (docTitle && !isRejectedTitle(docTitle)) {
    return docTitle;
  }
  return null;
}

function extractTitle(doc: Document): string {
  for (const selector of PARSER_SELECTORS.title) {
    const text = getText(doc.querySelector(selector));
    if (text && text.length > 0 && !isRejectedTitle(text)) {
      return text;
    }
  }

  const meta = doc.querySelector('meta[property="og:title"]');
  if (meta instanceof HTMLMetaElement && meta.content) {
    const text = normalizeTitle(meta.content);
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  const ld = getLdProduct(doc);
  if (ld?.name) {
    const text = normalizeTitle(String(ld.name));
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  const pageTitle = normalizeTitle((doc.title || "").replace(/\s*\|\s*eBay.*$/i, ""));
  if (pageTitle && !isRejectedTitle(pageTitle)) {
    return pageTitle;
  }

  return "";
}

export function extractListingTitleFromDocument(doc: Document): string {
  const ld = getLdProduct(doc);
  if (ld?.name) {
    const text = normalizeTitle(String(ld.name));
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  return findTitle(doc) || extractTitle(doc) || "";
}
