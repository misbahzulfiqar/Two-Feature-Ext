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

const TITLE_WAIT_SELECTOR = [
  'h1[data-testid="x-item-title-label"]',
  ".x-item-title__mainTitle",
  "h1.x-item-title__mainTitle",
  'h1[itemprop="name"]',
  'meta[property="og:title"]',
  'script[type="application/ld+json"]',
].join(", ");

export function extractListingTitleInPage(parserSelectors) {
  const titleSelectors = parserSelectors?.title || [];
  const decodeHtmlEntities = (text) => {
    const decoder = document.createElement("textarea");
    let decoded = String(text || "");
    for (let i = 0; i < 3; i += 1) {
      decoder.innerHTML = decoded;
      if (decoder.value === decoded) break;
      decoded = decoder.value;
    }
    return decoded;
  };

  const stripHtmlFromTitle = (text) =>
    String(text || "")
      .replace(/<\s*wbr\s*\/?\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, " ")
      .replace(/<\/?[^>]+>/g, "");

  const normalizeTitle = (text) =>
    stripHtmlFromTitle(decodeHtmlEntities(text))
      .replace(/^\s*Details about\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

  const getText = (el) => normalizeTitle(el?.textContent ?? "");

  const isRejectedTitle = (text) => {
    const value = String(text || "").trim();
    if (value.length < 8) return true;
    return (
      /^Was\s+US?\s?\$/i.test(value) ||
      /^\d+\.\d+\s*in/i.test(value) ||
      /best offer/i.test(value) ||
      /buy it now/i.test(value) ||
      /popular categories from this store/i.test(value) ||
      /detailed seller ratings/i.test(value) ||
      /shop by category/i.test(value) ||
      /about this seller/i.test(value) ||
      /^seller information$/i.test(value) ||
      /^feedback$/i.test(value) ||
      /items for sale/i.test(value) ||
      /people who viewed this/i.test(value) ||
      /similar sponsored items/i.test(value)
    );
  };

  const getLdProduct = () => {
    const ldScripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );

    for (const script of ldScripts) {
      const raw = script.textContent || "";
      if (!raw.trim()) continue;

      try {
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          const type = item?.["@type"];
          const isProduct =
            type === "Product" ||
            (Array.isArray(type) && type.includes("Product"));

          if (item && isProduct) {
            return item;
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    return null;
  };

  const findTitle = () => {
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
      const el = document.querySelector(selector);
      const text = getText(el);
      if (text && !isRejectedTitle(text)) {
        return text;
      }
    }

    const ld = getLdProduct();
    if (ld?.name) {
      const text = normalizeTitle(String(ld.name));
      if (text && !isRejectedTitle(text)) {
        return text;
      }
    }

    const docTitle = normalizeTitle(
      (document.title || "").replace(/\s*\|\s*eBay.*$/i, ""),
    );
    if (docTitle && !isRejectedTitle(docTitle)) {
      return docTitle;
    }
    return null;
  };

  const extractTitle = () => {
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      const text = getText(el);
      if (text && text.length > 0 && !isRejectedTitle(text)) {
        return text;
      }
    }

    const meta = document.querySelector('meta[property="og:title"]');
    if (meta?.content) {
      const text = normalizeTitle(String(meta.content));
      if (text && !isRejectedTitle(text)) {
        return text;
      }
    }

    const ld = getLdProduct();
    if (ld?.name) {
      const text = normalizeTitle(String(ld.name));
      if (text && !isRejectedTitle(text)) {
        return text;
      }
    }

    const pageTitle = normalizeTitle(
      (document.title || "").replace(/\s*\|\s*eBay.*$/i, ""),
    );
    if (pageTitle && !isRejectedTitle(pageTitle)) {
      return pageTitle;
    }

    return "";
  };

  const ldProduct = getLdProduct();
  if (ldProduct?.name) {
    const text = normalizeTitle(String(ldProduct.name));
    if (text && !isRejectedTitle(text)) {
      return text;
    }
  }

  return findTitle() || extractTitle() || "";
}

export async function fetchEbayListing(page, listingUrl) {
  await page.goto(listingUrl, { waitUntil: "domcontentloaded" });
  await page
    .waitForSelector(TITLE_WAIT_SELECTOR, { timeout: 10000 })
    .catch(() => undefined);

  const title = await page.evaluate(extractListingTitleInPage, PARSER_SELECTORS);

  return {
    title: typeof title === "string" ? title.trim() : "",
    sku: "",
    price: "",
  };
}
