export function extractListingSpecificsInPage() {
  const specifics = [];
  const embeddedKeys = [
    "nameValuePairs",
    "additionalProperty",
    "localizedAspects",
    "itemSpecifics",
    "aspects",
  ];

  const cleanText = (text) =>
    String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*\[?read more\]?\s*$/i, "")
      .replace(/:$/, "")
      .trim();

  const isRejectedKey = (key) =>
    /^see all/i.test(key) ||
    /^show more/i.test(key) ||
    /^read more/i.test(key) ||
    /^item specifics$/i.test(key) ||
    /^about this item$/i.test(key) ||
    /^about this product$/i.test(key) ||
    /^shipping$/i.test(key) ||
    /^delivery$/i.test(key) ||
    /^payments?$/i.test(key) ||
    /^returns?$/i.test(key) ||
    /^watch list$/i.test(key) ||
    /^item location$/i.test(key) ||
    /^located in$/i.test(key) ||
    /^handling time$/i.test(key) ||
    /^labels$/i.test(key) ||
    /^values$/i.test(key) ||
    /^was$/i.test(key) ||
    /^item price$/i.test(key) ||
    /^estimated total$/i.test(key) ||
    /^pickup$/i.test(key) ||
    /^buy it now/i.test(key) ||
    /^duration$/i.test(key) ||
    /^start time$/i.test(key) ||
    /^custom label$/i.test(key) ||
    /^seller notes$/i.test(key) ||
    /%\s*off/i.test(key) ||
    /^us\s*\$/i.test(key) ||
    /\$\d/.test(key);

  const isSchemaClassValue = (value) =>
    /^[A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+$/.test(String(value).trim());

  const mergeValues = (left, right) => {
    if (!left) return right;
    if (!right) return left;
    if (left.toLowerCase() === right.toLowerCase()) {
      return left.length >= right.length ? left : right;
    }
    if (left.toLowerCase().includes(right.toLowerCase())) return left;
    if (right.toLowerCase().includes(left.toLowerCase())) return right;
    const parts = [];
    const seen = new Set();
    for (const source of [left, right]) {
      String(source)
        .split(/\s*,\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const token = part.toLowerCase();
          if (seen.has(token)) return;
          seen.add(token);
          parts.push(part);
        });
    }
    return parts.join(", ");
  };

  const addSpecific = (rawKey, rawValue) => {
    const originalKey = cleanText(rawKey);
    const key = originalKey.replace(/^@/, "");
    let value = cleanText(rawValue).replace(/\s*(see more|show more|read more)\s*$/i, "");
    if (!key || !value || isRejectedKey(key) || key.length > 80) {
      return;
    }
    if (/^@(type|id|context|graph)$/i.test(originalKey)) {
      return;
    }
    if (/^(type|id|context|graph)$/i.test(key) && isSchemaClassValue(value)) {
      return;
    }
    if (
      /^type$/i.test(key) &&
      /^(PriceSpecification|UnitPriceSpecification|CompoundPriceSpecification|Offer|AggregateOffer|Product|Brand|Organization)$/i.test(
        value,
      )
    ) {
      return;
    }
    if (/^condition$/i.test(key) && value.length > 120) {
      const shortCondition = value.match(
        /^(new(?:\s+other)?|used|open box|refurbished|seller refurbished|manufacturer refurbished|for parts(?: or not working)?)/i,
      );
      value = shortCondition ? shortCondition[0] : value.slice(0, 120).trim();
    }
    if (value.length > 4000) {
      value = value.slice(0, 4000).trim();
    }
    const existing = specifics.find((item) => item.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = mergeValues(existing.value, value);
      return;
    }
    specifics.push({ key, value });
  };

  const sliceBalanced = (text) => {
    const open = text[0];
    const close = open === "[" ? "]" : open === "{" ? "}" : null;
    if (!close) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) return text.slice(0, i + 1);
      }
    }
    return null;
  };

  const flattenValue = (raw) => {
    if (typeof raw === "string" || typeof raw === "number") return String(raw);
    if (Array.isArray(raw)) return raw.map(flattenValue).filter(Boolean).join(", ");
    if (!raw || typeof raw !== "object") return "";
    if (raw.localizedValue || raw.value || raw.content || raw.Value) {
      return flattenValue(raw.localizedValue || raw.value || raw.content || raw.Value);
    }
    if (typeof raw.name === "string" && !isSchemaClassValue(raw.name)) {
      return raw.name;
    }
    return "";
  };

  const nameFromRecord = (record) => {
    const raw =
      record.name ||
      record.key ||
      record.label ||
      record.localizedAspectName ||
      record.localizedName ||
      record.Name;
    return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  };

  const valueFromRecord = (record) => {
    if (record.values !== undefined) return flattenValue(record.values);
    return flattenValue(
      record.value ||
        record.content ||
        record.localizedValue ||
        record.localizedAspectValue ||
        record.Value,
    );
  };

  const looksLikeSpecificRecord = (record, parentKey) => {
    const parent = String(parentKey || "").toLowerCase();
    const types = Array.isArray(record["@type"])
      ? record["@type"]
      : record["@type"]
        ? [record["@type"]]
        : [];
    if (types.length > 0 && !types.includes("PropertyValue")) {
      return false;
    }
    if (types.includes("PropertyValue")) return true;
    if (Array.isArray(record.values) && nameFromRecord(record)) return true;
    return Boolean(
      nameFromRecord(record) &&
        valueFromRecord(record) &&
        isSpecContainerKey(parent),
    );
  };

  const isSpecContainerKey = (key) => {
    const lower = String(key || "").toLowerCase();
    if (lower.includes("pricespecification")) return false;
    return (
      lower === "aspects" ||
      lower === "localizedaspects" ||
      lower === "namevaluepairs" ||
      lower === "additionalproperty" ||
      lower === "itemspecifics" ||
      lower.includes("itemspecific") ||
      lower.includes("namevaluepair")
    );
  };

  const shouldSkipNestedKey = (key) => {
    const lower = String(key || "").toLowerCase();
    if (lower.startsWith("@")) return true;
    return (
      lower === "offers" ||
      lower.includes("pricespecification") ||
      lower === "aggregaterating" ||
      lower === "review" ||
      lower === "reviews" ||
      lower === "image" ||
      lower === "logo" ||
      lower === "seller" ||
      lower === "shippingdetails" ||
      lower === "mainentityofpage"
    );
  };

  const scanObject = (obj, parentKey = "") => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item) => scanObject(item, parentKey));
      return;
    }

    if (looksLikeSpecificRecord(obj, parentKey)) {
      addSpecific(nameFromRecord(obj), valueFromRecord(obj));
    }

    const brand = obj.brand;
    if (!parentKey || String(parentKey).toLowerCase() === "product") {
      if (typeof brand === "string") addSpecific("Brand", brand);
      else if (brand && typeof brand === "object" && brand.name) addSpecific("Brand", brand.name);
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (shouldSkipNestedKey(key)) return;
      if (
        isSpecContainerKey(key) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        Object.entries(value).forEach(([specificKey, specificValue]) => {
          if (String(specificKey).startsWith("@")) return;
          if (typeof specificValue === "string" || typeof specificValue === "number") {
            addSpecific(specificKey, String(specificValue));
          }
        });
      }
      if (value && typeof value === "object") scanObject(value, key);
    });
  };

  const parseScriptPayloads = (text) => {
    const payloads = [];
    const trimmed = text.trim();
    const tryParse = (raw) => {
      try {
        payloads.push(JSON.parse(raw));
        return true;
      } catch {
        return false;
      }
    };
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && tryParse(trimmed)) {
      return payloads;
    }
    const firstObj = trimmed.search(/[{[]/);
    if (firstObj >= 0) {
      const sliced = sliceBalanced(trimmed.slice(firstObj));
      if (sliced) tryParse(sliced);
    }
    return payloads;
  };

  const extractJsonAfterKey = (html, key) => {
    const results = [];
    const needle = `"${key}"`;
    let searchFrom = 0;
    while (searchFrom < html.length) {
      const idx = html.indexOf(needle, searchFrom);
      if (idx === -1) break;
      searchFrom = idx + needle.length;
      const afterKey = html.slice(searchFrom).replace(/^\s*:\s*/, "");
      if (!afterKey.startsWith("{") && !afterKey.startsWith("[")) continue;
      const sliced = sliceBalanced(afterKey);
      if (!sliced) continue;
      try {
        results.push(JSON.parse(sliced));
      } catch {
        // ignore invalid JSON slices
      }
      if (results.length >= 8) break;
    }
    return results;
  };

  const addFromLabelValue = (row) => {
    const label =
      row.querySelector(".ux-labels-values__labels-content") ||
      row.querySelector(".ux-labels-values__labels") ||
      row.querySelector('[class*="labels"]');
    const value =
      row.querySelector(".ux-labels-values__values-content") ||
      row.querySelector(".ux-labels-values__values") ||
      row.querySelector('[class*="values"]');
    const spans = value
      ? Array.from(value.querySelectorAll(".ux-textspans"))
          .map((span) => cleanText(span.innerText || span.textContent))
          .filter((text) => text && !/^(see more|show more|read more)$/i.test(text))
      : [];
    const valueText = value?.innerText || value?.textContent;
    addSpecific(label?.innerText || label?.textContent, valueText);
    if (spans.length > 0) {
      addSpecific(label?.innerText || label?.textContent, spans.join(", "));
    }
  };

  document.querySelectorAll("button, a").forEach((el) => {
    const text = cleanText(el.innerText || el.textContent);
    if (/^(see more|show more|read more)$/i.test(text) && el.closest(".ux-labels-values, .ux-layout-section--aspects, [data-testid='x-about-this-item']")) {
      el.click();
    }
  });

  document
    .querySelectorAll(
      "dl.ux-labels-values, .ux-labels-values, [data-testid='ux-labels-values'], .ux-layout-section-evo__col",
    )
    .forEach(addFromLabelValue);

  document.querySelectorAll(".ux-layout-section-evo__row").forEach((row) => {
    row.querySelectorAll(".ux-labels-values, .ux-layout-section-evo__col").forEach(addFromLabelValue);
  });

  document.querySelectorAll("dl").forEach((dl) => {
    const terms = dl.querySelectorAll("dt");
    const descriptions = dl.querySelectorAll("dd");
    terms.forEach((term, index) => {
      addSpecific(term.innerText, descriptions[index]?.innerText);
    });
  });

  document
    .querySelectorAll(
      '[data-testid="x-about-this-item"], .ux-layout-section--aspects, .x-about-this-item, #viTabs_0_is',
    )
    .forEach((section) => {
      section.querySelectorAll(".ux-labels-values, .ux-layout-section-evo__col, dl").forEach((row) => {
        addFromLabelValue(row);
        const terms = row.querySelectorAll("dt");
        const descriptions = row.querySelectorAll("dd");
        terms.forEach((term, index) => {
          addSpecific(term.innerText, descriptions[index]?.innerText);
        });
      });
    });

  document.querySelectorAll("script").forEach((script) => {
    const text = (script.textContent || "").trim();
    if (!text) return;
    const scriptType = (script.getAttribute("type") || "").toLowerCase();
    const isJsonScript =
      scriptType.includes("ld+json") || scriptType.includes("application/json");
    const looksEmbedded =
      /nameValuePairs|additionalProperty|itemSpecifics|localizedAspects|"aspects"/.test(text);
    if (!isJsonScript && !looksEmbedded) return;

    parseScriptPayloads(text).forEach((payload) => scanObject(payload));
    embeddedKeys.forEach((key) => {
      extractJsonAfterKey(text, key).forEach((payload) => scanObject(payload, key));
    });
  });

  const html = document.documentElement?.innerHTML || "";
  if (html) {
    embeddedKeys.forEach((key) => {
      extractJsonAfterKey(html, key).forEach((payload) => scanObject(payload, key));
    });

    const decodedHtml = html.replace(/\\u0022/gi, '"').replace(/&quot;/g, '"');
    const labelValueRe =
      /ux-labels-values__labels[\s\S]{0,500}?ux-textspans[^>]*>([^<]{1,80})[\s\S]{0,1200}?ux-labels-values__values[\s\S]{0,800}?ux-textspans[^>]*>([^<]{1,2000})/gi;
    for (const match of decodedHtml.matchAll(labelValueRe)) {
      addSpecific(match[1], match[2]);
    }

    const nameValuesRe =
      /"name"\s*:\s*"((?:\\.|[^"\\])+)"\s*,\s*"values"\s*:\s*(\[[^\]]*])/g;
    for (const match of decodedHtml.matchAll(nameValuesRe)) {
      try {
        addSpecific(match[1], flattenValue(JSON.parse(match[2])));
      } catch {
        // ignore invalid values arrays
      }
    }
  }

  return specifics;
}

export async function getItemSpecifics(page) {
  return page.evaluate(extractListingSpecificsInPage);
}

/**
 * Image-related selectors. Listed for the gallery, but prepareListingPage
 * waits on title/specifics/fitment surfaces instead of this selector.
 */
export const IMAGE_WAIT_SELECTOR = [
  ".ux-image-grid-item.image-treatment.rounded-edges img",
  "#PicturePanel .ux-image-grid-item img",
  ".x-photos-min-view img",
  ".ux-image-carousel img",
  'script[type="application/ld+json"]',
  'meta[property="og:image"]',
].join(", ");

export function extractListingImagesInPage() {
  const primarySelector = ".ux-image-grid-item.image-treatment.rounded-edges img";
  const alternateSelectors = [
    "#PicturePanel .ux-image-grid-item img",
    ".x-photos-min-view img",
    ".ux-image-carousel img",
  ];

  const qualityRank = (url) => {
    if (/s-l(?:1600|1500)(?:\D|$)/i.test(url)) return 3;
    if (/s-l500(?:\D|$)/i.test(url)) return 2;
    if (/s-l140(?:\D|$)/i.test(url)) return 1;
    return 0;
  };

  const imageIdentity = (url) => {
    const gallery = url.match(/\/g\/([^/?#]+)/i)?.[1];
    if (gallery) return `g:${gallery}`;
    const zoom = url.match(/\/z\/([^/?#]+)/i)?.[1];
    if (zoom) return `z:${zoom}`;
    const withoutSuffix = url.split("#")[0]?.split("?")[0] ?? url;
    return withoutSuffix.replace(/s-l\d+/gi, "");
  };

  const isRejected = (url) =>
    !url ||
    /^data:image/i.test(url) ||
    /placeholder|spacer|pixel\.gif|1x1|blank\.gif/i.test(url);

  const resolveUrl = (raw) => {
    const value = String(raw || "").trim();
    if (!value || /^data:image/i.test(value)) return "";
    const base = document.baseURI || "https://www.ebay.com/";
    try {
      const url = new URL(value, base).href;
      if (!/^https?:/i.test(url) || isRejected(url)) return "";
      return url;
    } catch {
      return "";
    }
  };

  const byIdentity = new Map();

  const pushImage = (raw) => {
    const url = resolveUrl(raw);
    if (!url) return;
    const identity = imageIdentity(url);
    const current = byIdentity.get(identity);
    if (!current || qualityRank(url) > qualityRank(current)) {
      byIdentity.set(identity, url);
    }
  };

  const collectImgSrc = (img) => {
    const candidates = [];
    for (const attr of ["src", "data-src", "data-zoom-src", "data-lazy-src"]) {
      const value = img.getAttribute(attr);
      if (value) candidates.push(value);
    }
    for (const attr of ["srcset", "data-srcset"]) {
      const value = img.getAttribute(attr);
      if (!value) continue;
      for (const part of value.split(",")) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) candidates.push(candidate);
      }
    }
    return candidates;
  };

  const collectSelector = (selector) => {
    document.querySelectorAll(selector).forEach((img) => {
      collectImgSrc(img).forEach(pushImage);
    });
  };

  collectSelector(primarySelector);
  if (byIdentity.size === 0) {
    alternateSelectors.forEach(collectSelector);
  }

  if (byIdentity.size === 0) {
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      let payload;
      try {
        payload = JSON.parse(script.textContent || "");
      } catch {
        return;
      }
      const queue = Array.isArray(payload) ? [...payload] : [payload];
      while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
          queue.push(...node);
          continue;
        }
        if (node["@graph"]) queue.push(node["@graph"]);
        const type = node["@type"];
        const types = Array.isArray(type) ? type : type ? [type] : [];
        if (!types.includes("Product") || node.image == null) continue;
        const images = Array.isArray(node.image) ? node.image : [node.image];
        images.forEach((image) => {
          if (typeof image === "string") {
            pushImage(image);
            return;
          }
          if (image && typeof image === "object" && typeof image.url === "string") {
            pushImage(image.url);
          }
        });
      }
    });
  }

  if (byIdentity.size === 0) {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    if (og) pushImage(og);
  }

  const urls = [...byIdentity.values()].map((url) => url.replace(/s-l\d+/gi, "s-l1600"));
  if (urls.length > 1 && imageIdentity(urls[0]) === imageIdentity(urls[urls.length - 1])) {
    urls.pop();
  }
  return urls;
}

export async function prepareListingPage(page, listingUrl, options = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const html = typeof options.html === "string" ? options.html : "";
  if (html) {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
  } else {
    try {
      await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (error) {
      const message = String(error?.message || error);
      if (!message.includes("detached") && !message.includes("Navigation")) {
        throw error;
      }
    }
    await page
      .waitForFunction(
        () => {
          const specs = document.querySelector(
            ".ux-labels-values, [data-testid='ux-labels-values'], .ux-layout-section--aspects",
          );
          const fitment = document.querySelector(
            ".motors-compatibility-table, [data-testid='d-motors-compatibility-table'], [data-testid='d-item-compatibility']",
          );
          return Boolean(specs || fitment);
        },
        { timeout: 20000 },
      )
      .catch(() => undefined);
  }

  await wait(300);
}

/**
 * Listing category and seller Store categories. Self-contained for page.evaluate.
 * Only `category` is applied to the target listing.
 */
export function extractListingCategoriesInPage() {
  const clean = (value) =>
    String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const genericNames = new Set([
    "ebay",
    "home",
    "back",
    "back to search results",
    "back to home page",
    "see more",
    "see all",
    "see all categories",
    "shop by category",
    "all categories",
    "categories",
    "browse",
    "browse categories",
    "marketplace",
  ]);

  const title = clean(
    document.querySelector(
      "h1[data-testid='x-item-title-label'], h1.x-item-title__mainTitle, h1[itemprop='name'], h1",
    )?.textContent,
  );

  const isGeneric = (name) => {
    const value = clean(name);
    if (!value) return true;
    const lower = value.toLowerCase();
    return genericNames.has(lower) || /^see more\b/i.test(value) || value === "..." || value === "…";
  };

  const looksLikeTitle = (name) => {
    const value = clean(name);
    if (!title || value.length < 20) return false;
    const crumb = value.toLowerCase();
    const heading = title.toLowerCase();
    return crumb === heading || heading.startsWith(crumb);
  };

  const isItemLink = (href) => /\/itm(?:\/|$|\?)/i.test(String(href || ""));

  const isStoreLink = (href) => /\/str\/|store_cat|store_name|_ssn=|\/stores\//i.test(String(href || ""));

  const categoryIdFromUrl = (href) => {
    const raw = String(href || "").trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw, document.baseURI || "https://www.ebay.com/");
    } catch {
      return "";
    }
    const keys = ["_sacat", "sacat", "categoryId", "category_id", "categoryid", "catId", "catid", "_catid"];
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value && /^\d{2,}$/.test(value) && value !== "0") return value;
    }
    const browse = url.pathname.match(/\/b\/[^/]+\/(\d+)(?:\/|$)/i);
    if (browse?.[1] && browse[1] !== "0") return browse[1];
    const search = url.pathname.match(/\/sch\/(\d+)(?:\/|$)/i);
    if (search?.[1] && search[1] !== "0") return search[1];
    const inline = raw.match(/(?:_sacat|categoryId|category_id|catId)(?:=|%3D|\/)(\d+)/i);
    if (inline?.[1] && inline[1] !== "0") return inline[1];
    return "";
  };

  const splitTrail = (name) =>
    clean(name)
      .split(/\s*(?:\||>|\/|\u203a)\s*/)
      .map(clean)
      .filter(Boolean);

  const acceptName = (name) => {
    const value = clean(name);
    if (!value || isGeneric(value) || looksLikeTitle(value)) return [];
    return splitTrail(value).filter((part) => part && !isGeneric(part) && !looksLikeTitle(part));
  };

  const storeCategories = [];
  const addStore = (name, id, path) => {
    const parts = acceptName(name);
    const storeName = parts.length > 0 ? parts[parts.length - 1] : clean(name);
    if (!storeName || isGeneric(storeName)) return;
    if (storeCategories.some((item) => item.name.toLowerCase() === storeName.toLowerCase())) return;
    const entry = { name: storeName };
    if (id && /^\d+$/.test(String(id)) && String(id) !== "0") entry.id = String(id);
    if (Array.isArray(path) && path.length > 0) {
      const storePath = path.flatMap((part) => acceptName(part));
      if (storePath.length > 0) entry.path = storePath;
    }
    storeCategories.push(entry);
  };

  const selectorGroups = [
    ["nav[aria-label='breadcrumb']", "nav[aria-label='Breadcrumb']"],
    ["nav.breadcrumbs", ".breadcrumbs", ".seo-breadcrumbs", ".seo-breadcrumbs-container"],
    ["[data-testid='ux-breadcrumbs']", ".ux-breadcrumbs", ".x-breadcrumb"],
    ["#vi-VR-brumb-lnkLst", "ul.breadcrumb", "ol.breadcrumb"],
  ];

  const crumbsFrom = (root) => {
    const links = [];
    const items = root.querySelectorAll("li");
    const nodes = items.length > 0 ? items : root.querySelectorAll("a");
    nodes.forEach((node) => {
      const anchor = node.matches("a") ? node : node.querySelector("a");
      const href = anchor ? anchor.getAttribute("href") || "" : "";
      const name = clean(anchor ? anchor.textContent : node.textContent);
      if (!name) return;
      if (href && isItemLink(href)) return;
      if (href && isStoreLink(href)) {
        addStore(name, categoryIdFromUrl(href));
        return;
      }
      if (/see more/i.test(name)) return;
      for (const part of acceptName(name)) {
        links.push({ name: part, href });
      }
    });
    return links;
  };

  let chosen = [];
  for (const group of selectorGroups) {
    const roots = [];
    for (const selector of group) {
      document.querySelectorAll(selector).forEach((node) => roots.push(node));
    }
    const links = roots.flatMap((root) => crumbsFrom(root));
    if (links.length > 0) {
      chosen = links;
      break;
    }
  }

  const pathFromLinks = (links) => {
    const path = [];
    for (const link of links) {
      if (path.some((part) => part.toLowerCase() === link.name.toLowerCase())) continue;
      path.push(link.name);
    }
    let id = "";
    for (let index = links.length - 1; index >= 0; index -= 1) {
      const found = categoryIdFromUrl(links[index].href);
      if (found) {
        id = found;
        break;
      }
    }
    return { path, id };
  };

  let draft = pathFromLinks(chosen);

  if (!draft.id || draft.path.length < 2) {
    const roots = [];
    document
      .querySelectorAll(
        "nav[aria-label='breadcrumb'], nav[aria-label='Breadcrumb'], nav.breadcrumbs, .breadcrumbs, [data-testid='ux-breadcrumbs'], .ux-breadcrumbs, #vi-VR-brumb-lnkLst",
      )
      .forEach((node) => roots.push(node));
    const scopes = roots.length > 0 ? roots : [document];
    const browseLinks = [];
    for (const root of scopes) {
      root.querySelectorAll("a[href*='/b/']").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (isItemLink(href) || isStoreLink(href)) return;
        for (const part of acceptName(anchor.textContent)) {
          browseLinks.push({ name: part, href });
        }
      });
    }
    const fromBrowse = pathFromLinks(browseLinks);
    if (fromBrowse.path.length > draft.path.length) draft = { path: fromBrowse.path, id: draft.id || fromBrowse.id };
    if (!draft.id && fromBrowse.id) draft.id = fromBrowse.id;
  }

  let jsonPath = [];
  let jsonName = "";
  let primaryId = "";
  let jsonId = "";

  const notePath = (value) => {
    const parts = Array.isArray(value) ? value.flatMap((part) => acceptName(part)) : acceptName(value);
    if (parts.length > jsonPath.length) jsonPath = parts;
  };

  const noteId = (value, primary) => {
    const id = String(value ?? "").trim();
    if (!/^\d{2,}$/.test(id) || id === "0") return;
    if (primary) {
      if (!primaryId) primaryId = id;
      return;
    }
    if (!jsonId) jsonId = id;
  };

  const isStoreKey = (key) => /store/i.test(key) && /cat/i.test(key);

  const readBreadcrumbList = (node) => {
    const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
    const links = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const itemValue = item.item;
      const href =
        typeof itemValue === "string"
          ? itemValue
          : clean(itemValue?.["@id"] || itemValue?.url || itemValue?.id || "");
      const name = clean(item.name || itemValue?.name);
      if (!name || isItemLink(href)) continue;
      if (isStoreLink(href)) {
        addStore(name, categoryIdFromUrl(href));
        continue;
      }
      for (const part of acceptName(name)) {
        links.push({ name: part, href });
      }
    }
    const parsed = pathFromLinks(links);
    if (parsed.path.length > jsonPath.length) jsonPath = parsed.path;
    if (parsed.id) noteId(parsed.id, false);
  };

  const typeIncludes = (type, expected) => {
    if (typeof type === "string") return type.toLowerCase() === expected.toLowerCase();
    if (Array.isArray(type)) return type.some((entry) => typeIncludes(entry, expected));
    return false;
  };

  const walk = (node, depth, keyHint) => {
    if (depth > 8 || node == null) return;
    if (typeof node === "string") {
      if (keyHint === "categoryPath" || keyHint === "categoryName" || keyHint === "primaryCategoryName") {
        if (keyHint === "categoryPath") notePath(node);
        else if (!jsonName) jsonName = clean(node);
      }
      return;
    }
    if (typeof node === "number" && (keyHint === "categoryId" || keyHint === "primaryCategoryId")) {
      noteId(node, keyHint === "primaryCategoryId");
      return;
    }
    if (Array.isArray(node)) {
      if (keyHint === "categoryPath" || keyHint === "primaryCategoryIdPath") {
        if (keyHint === "categoryPath") notePath(node);
        const last = node.length > 0 ? node[node.length - 1] : "";
        if (/^\d+$/.test(String(last))) noteId(last, keyHint === "primaryCategoryIdPath");
      }
      for (const entry of node) walk(entry, depth + 1, keyHint);
      return;
    }
    if (typeof node !== "object") return;
    if (typeIncludes(node["@type"], "BreadcrumbList")) readBreadcrumbList(node);
    for (const [key, value] of Object.entries(node)) {
      if (isStoreKey(key)) {
        if (typeof value === "string") addStore(value);
        else if (Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") addStore(entry);
            else if (entry && typeof entry === "object") addStore(entry.name, entry.id || entry.categoryId, entry.path);
          }
        } else if (value && typeof value === "object") {
          addStore(value.name, value.id || value.categoryId, value.path);
        }
        continue;
      }
      if (key === "categoryId") noteId(value, false);
      if (key === "primaryCategoryId") noteId(value, true);
      if (key === "categoryName" && typeof value === "string" && !jsonName) jsonName = clean(value);
      if (key === "primaryCategoryName" && typeof value === "string" && !jsonName) jsonName = clean(value);
      if (key === "categoryPath") notePath(value);
      walk(value, depth + 1, key);
    }
  };

  const readScript = (text) => {
    const source = String(text || "").trim();
    if (!source) return;
    try {
      walk(JSON.parse(source), 0, "");
      return;
    } catch {
      // Large eBay scripts are not pure JSON. Read the known category fields from them.
    }
    if (!/primaryCategoryId|categoryPath|BreadcrumbList|categoryName/i.test(source)) return;
    const primary = source.match(/"primaryCategoryId"\s*:\s*"?(\d+)"?/);
    if (primary?.[1]) noteId(primary[1], true);
    const category = source.match(/"categoryId"\s*:\s*"?(\d+)"?/);
    if (category?.[1]) noteId(category[1], false);
    const path = source.match(/"categoryPath"\s*:\s*"([^"]+)"/);
    if (path?.[1]) notePath(path[1]);
    const primaryName = source.match(/"primaryCategoryName"\s*:\s*"([^"]+)"/);
    if (primaryName?.[1]) jsonName = clean(primaryName[1]);
    const name = source.match(/"categoryName"\s*:\s*"([^"]+)"/);
    if (name?.[1] && !jsonName) jsonName = clean(name[1]);
  };

  document.querySelectorAll("script[type='application/ld+json'], script[type='application/json']").forEach((script) => {
    readScript(script.textContent);
  });
  let extraScripts = 0;
  document.querySelectorAll("script:not([type]), script[type='text/javascript']").forEach((script) => {
    if (extraScripts >= 30) return;
    const text = script.textContent || "";
    if (text.length > 2000000 || !/primaryCategoryId|categoryPath|BreadcrumbList/i.test(text)) return;
    extraScripts += 1;
    readScript(text);
  });

  if (jsonPath.length > draft.path.length) draft.path = jsonPath;
  if (!draft.id) draft.id = primaryId || jsonId;
  if (draft.path.length === 0 && jsonName) draft.path = acceptName(jsonName);

  const path = [];
  for (const part of draft.path) {
    const value = clean(part);
    if (!value || isGeneric(value) || looksLikeTitle(value)) continue;
    if (path.some((item) => item.toLowerCase() === value.toLowerCase())) continue;
    path.push(value);
  }
  let name = path.length > 0 ? path[path.length - 1] : "";
  if (!name && jsonName && !isGeneric(jsonName) && !looksLikeTitle(jsonName)) {
    name = clean(jsonName);
    path.push(name);
  }
  if (name && path.length === 0) path.push(name);
  if (path.length > 0) name = path[path.length - 1];

  return {
    category: {
      id: /^\d{2,}$/.test(draft.id) ? draft.id : "",
      name: name || "",
      path,
    },
    storeCategories,
  };
}

export async function fetchEbayListing(page, listingUrl, options = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const evaluate = async (fn, ...args) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await page.evaluate(fn, ...args);
      } catch (error) {
        const message = String(error?.message || error);
        if (!message.includes("detached") || attempt === 2) {
          throw error;
        }
        await wait(1500);
      }
    }
    return undefined;
  };

  await prepareListingPage(page, listingUrl, options);
  const itemSpecifics = await evaluate(extractListingSpecificsInPage);
  const images = await evaluate(extractListingImagesInPage);
  const categories = await evaluate(extractListingCategoriesInPage);
  const category =
    categories?.category && typeof categories.category === "object"
      ? {
          id: String(categories.category.id ?? ""),
          name: String(categories.category.name ?? ""),
          path: Array.isArray(categories.category.path)
            ? categories.category.path.map((part) => String(part ?? "")).filter(Boolean)
            : [],
        }
      : { id: "", name: "", path: [] };
  if (category.name && category.path.length === 0) category.path = [category.name];

  return {
    title: "",
    sku: "",
    price: "",
    images: Array.isArray(images) ? images : [],
    itemSpecifics: Array.isArray(itemSpecifics) ? itemSpecifics : [],
    condition: "",
    conditionDescription: "",
    description: "",
    category,
    storeCategories: Array.isArray(categories?.storeCategories) ? categories.storeCategories : [],
    shipping: { service: "", cost: "", handlingTime: "", location: "", details: "" },
    weight: { value: "", unit: "" },
    dimensions: { length: "", width: "", height: "", unit: "", raw: "" },
    fitment: [],
    compatibility: [],
    compatibilityCount: 0,
  };
}
