export const EBAY_SELECTORS = {
  imageGrid: {
    image: ".ux-image-grid-item.image-treatment.rounded-edges img",
  },
};

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

const IMAGE_WAIT_SELECTOR = [
  ".ux-image-grid-item.image-treatment.rounded-edges img",
  "#PicturePanel .ux-image-grid-item img",
  ".x-photos-min-view img",
  ".ux-image-carousel img",
  'meta[property="og:image"]',
].join(", ");

const CATEGORY_WAIT_SELECTOR = [
  '[data-testid="breadcrumbs"]',
  "nav[aria-label*='breadcrumb' i]",
  ".seo-breadcrumb",
  ".breadcrumbs",
  '[data-testid="x-store-information"]',
  'script[type="application/ld+json"]',
].join(", ");

const SPECIFICS_WAIT_SELECTOR = [
  ".ux-labels-values",
  '[data-testid="ux-labels-values"]',
  ".ux-layout-section-evo__row",
  ".ux-layout-section--aspects",
  '[data-testid="x-about-this-item"]',
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
      /^error page$/i.test(value) ||
      /access denied/i.test(value) ||
      /pardon our interruption/i.test(value) ||
      /robot check/i.test(value) ||
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

export function extractListingImagesInPage(ebaySelectors) {
  const imageSelector =
    ebaySelectors?.imageGrid?.image ||
    ".ux-image-grid-item.image-treatment.rounded-edges img";
  const seenBase = new Map();

  const toAbsoluteUrl = (src) => {
    try {
      return new URL(src, document.baseURI || "https://www.ebay.com").href;
    } catch {
      return src;
    }
  };

  const getBase = (url) =>
    url
      .replace(/\/s-l\d+\./g, "/")
      .replace(/\/s-l\d+$/g, "")
      .split("?")[0]
      .split("#")[0];

  const getImageId = (url) => {
    const gMatch = url.match(/\/g\/([^/?#]+)/i);
    if (gMatch?.[1]) return gMatch[1];
    const zMatch = url.match(/\/z\/([^/?#]+)/i);
    if (zMatch?.[1]) return zMatch[1];
    return getBase(url);
  };

  const getPriority = (url) => {
    if (url.includes("s-l1600") || url.includes("s-l1500")) return 4;
    if (url.includes("s-l500")) return 2;
    if (url.includes("s-l140")) return 1;
    return 0;
  };

  const toHighRes = (url) =>
    url
      .replace(/\/s-l\d+(?=\.)/g, "/s-l1600")
      .replace(/\/s-l\d+$/g, "/s-l1600");

  const pushImage = (src) => {
    if (!src) return;
    if (src.includes("placeholder") || src.startsWith("data:image")) return;
    const absolute = toAbsoluteUrl(src);
    if (!/^https?:\/\//i.test(absolute)) return;
    const id = getImageId(absolute);
    const priority = getPriority(absolute);
    const existing = seenBase.get(id);
    if (!existing || priority > existing.priority) {
      seenBase.set(id, { url: absolute, priority });
    }
  };

  const collectImgSrc = (img) => {
    const values = [
      img.getAttribute("src"),
      img.getAttribute("data-src"),
      img.getAttribute("data-zoom-src"),
      img.getAttribute("data-lazy-src"),
    ];
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
    if (srcset) {
      for (const part of srcset.split(",")) {
        values.push(part.trim().split(/\s+/)[0]);
      }
    }
    return values.filter(Boolean);
  };

  document.querySelectorAll(imageSelector).forEach((img) => {
    collectImgSrc(img).forEach(pushImage);
  });

  if (!seenBase.size) {
    document
      .querySelectorAll(
        "#PicturePanel .ux-image-grid-item img, .x-photos-min-view img, .ux-image-carousel img",
      )
      .forEach((img) => {
        collectImgSrc(img).forEach(pushImage);
      });
  }

  if (!seenBase.size) {
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((script) => {
        const raw = script.textContent || "";
        if (!raw.trim()) return;
        try {
          const data = JSON.parse(raw);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            const type = item?.["@type"];
            const isProduct =
              type === "Product" ||
              (Array.isArray(type) && type.includes("Product"));
            if (!isProduct || item.image === undefined) continue;
            const images = Array.isArray(item.image) ? item.image : [item.image];
            for (const image of images) {
              if (typeof image === "string") pushImage(image);
              else if (image?.url) pushImage(image.url);
            }
          }
        } catch {
          // ignore JSON parse errors
        }
      });
  }

  if (!seenBase.size) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage?.content) {
      pushImage(ogImage.content);
    }
  }

  const urls = Array.from(seenBase.values()).map((entry) => toHighRes(entry.url));
  const first = urls[0];
  const last = urls[urls.length - 1];
  if (urls.length > 1 && first && last && getImageId(first) === getImageId(last)) {
    urls.pop();
  }
  return urls;
}

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

export function extractListingCategoriesInPage() {
  const category = { id: "", name: "", path: [] };

  const cleanText = (text) =>
    String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const uniqueNames = (names) => {
    const seen = new Set();
    const unique = [];
    names.forEach((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      unique.push(name);
    });
    return unique;
  };

  const isRejectedMarketplaceName = (name) =>
    /^(home|ebay|back to search|all categories|see all|shop by category)$/i.test(name);

  const isStoreHref = (href) =>
    /\/str\//i.test(href) ||
    /stores\.ebay\./i.test(href) ||
    /[?&]_ssn=/i.test(href) ||
    /[?&]storecat=/i.test(href) ||
    /[?&]_storecat=/i.test(href) ||
    /[?&]_sc=1/i.test(href);

  const categoryIdFromHref = (href) => {
    if (!href) return "";
    const sacat = href.match(/[?&]_sacat=(\d+)/i);
    if (sacat?.[1]) return sacat[1];
    const categoryId = href.match(/[?&](?:category[_-]?id|catid)=(\d+)/i);
    if (categoryId?.[1]) return categoryId[1];
    const bMatch = href.match(/\/b\/[^/?#]+\/(\d+)(?:\/|$)/i);
    if (bMatch?.[1]) return bMatch[1];
    const schMatch = href.match(/\/sch\/(\d+)\//i);
    if (schMatch?.[1]) return schMatch[1];
    return "";
  };

  const itemSelectors = [
    "a.seo-breadcrumb-text",
    "nav .seo-breadcrumb-text",
    "ul.seo-breadcrumb a",
    ".seo-breadcrumb a",
    '[data-testid="breadcrumbs"] a',
    '[data-testid="x-breadcrumb"] a',
    "nav[aria-label*='breadcrumb' i] a",
    "nav.breadcrumbs a",
    ".breadcrumbs a",
    "ol.breadcrumb a",
    ".x-breadcrumb a",
    ".ux-section-breadcrumbs a",
    '[class*="breadcrumb"] a',
  ];

  const pathEntries = [];
  for (const selector of itemSelectors) {
    const links = document.querySelectorAll(selector);
    if (!links.length) continue;
    links.forEach((link) => {
      const name = cleanText(link.innerText || link.textContent);
      const href = link.href || link.getAttribute("href") || "";
      if (!name || isRejectedMarketplaceName(name) || isStoreHref(href)) return;
      pathEntries.push({ name, href });
    });
    if (pathEntries.length) break;
  }

  if (pathEntries.length) {
    category.path = uniqueNames(pathEntries.map((entry) => entry.name));
    category.name = category.path[category.path.length - 1] || "";
    const lastWithId = [...pathEntries]
      .reverse()
      .find((entry) => categoryIdFromHref(entry.href));
    category.id = lastWithId ? categoryIdFromHref(lastWithId.href) : "";
  }

  if (!category.id || category.path.length < 2) {
    const breadcrumbRoots = document.querySelectorAll(
      '[data-testid="breadcrumbs"], [data-testid="x-breadcrumb"], nav[aria-label*="breadcrumb" i], nav.breadcrumbs, .seo-breadcrumb, .breadcrumbs, ol.breadcrumb, .x-breadcrumb, .ux-section-breadcrumbs, [class*="breadcrumb"]',
    );
    const fromBrowse = [];
    breadcrumbRoots.forEach((root) => {
      root.querySelectorAll('a[href*="/b/"]').forEach((link) => {
        const name = cleanText(link.innerText || link.textContent);
        const href = link.href || link.getAttribute("href") || "";
        if (!name || isRejectedMarketplaceName(name) || isStoreHref(href)) return;
        fromBrowse.push({ name, href });
      });
    });
    if (fromBrowse.length > category.path.length) {
      category.path = uniqueNames(fromBrowse.map((entry) => entry.name));
      category.name = category.path[category.path.length - 1] || category.name;
    }
    if (!category.id) {
      const lastWithId = [...(fromBrowse.length ? fromBrowse : pathEntries)]
        .reverse()
        .find((entry) => categoryIdFromHref(entry.href));
      if (lastWithId) category.id = categoryIdFromHref(lastWithId.href);
    }
  }

  const collectFromJson = (obj, parentKey = "") => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item) => collectFromJson(item, parentKey));
      return;
    }

    const parent = String(parentKey || "").toLowerCase();
    const type = obj["@type"];
    const isBreadcrumb =
      type === "BreadcrumbList" ||
      (Array.isArray(type) && type.includes("BreadcrumbList")) ||
      parent.includes("breadcrumb");

    if (isBreadcrumb) {
      const elements = Array.isArray(obj.itemListElement) ? obj.itemListElement : [];
      const names = elements
        .map((item) => {
          if (!item || typeof item !== "object") return { name: "", href: "" };
          const href =
            typeof item.item === "string"
              ? item.item
              : item.item?.["@id"] || item.item?.id || item.item?.url || "";
          return { name: cleanText(item.name), href: String(href || "") };
        })
        .filter(
          (entry) =>
            entry.name &&
            !isRejectedMarketplaceName(entry.name) &&
            !isStoreHref(entry.href),
        );
      if (names.length > category.path.length) {
        category.path = names.map((entry) => entry.name);
        category.name = names[names.length - 1]?.name || category.name;
        const lastWithId = [...names]
          .reverse()
          .find((entry) => categoryIdFromHref(entry.href));
        if (lastWithId && !category.id) category.id = categoryIdFromHref(lastWithId.href);
      }
    }

    if (typeof obj.category === "string" && !parent.includes("store")) {
      const parts = obj.category
        .split(/>|\/|\|/)
        .map(cleanText)
        .filter((part) => part && !isRejectedMarketplaceName(part));
      if (parts.length > category.path.length) {
        category.path = uniqueNames(parts);
        category.name = category.path[category.path.length - 1] || category.name;
      }
    }

    const maybeId =
      (obj.categoryId && String(obj.categoryId)) ||
      (obj.categoryID && String(obj.categoryID)) ||
      (obj.leafCategoryId && String(obj.leafCategoryId)) ||
      (obj.primaryCategoryId && String(obj.primaryCategoryId)) ||
      (obj.primaryCategory &&
        (obj.primaryCategory.categoryId || obj.primaryCategory.id) &&
        String(obj.primaryCategory.categoryId || obj.primaryCategory.id)) ||
      "";
    const maybeName = cleanText(
      obj.categoryName ||
        obj.primaryCategoryName ||
        obj.primaryCategory?.categoryName ||
        obj.primaryCategory?.name ||
        "",
    );
    const maybePath = Array.isArray(obj.categoryPath)
      ? obj.categoryPath.map(cleanText).filter(Boolean)
      : typeof obj.categoryPath === "string"
        ? obj.categoryPath.split(/>|\/|\|/).map(cleanText).filter(Boolean)
        : [];

    if (!parent.includes("store") && (maybeId || maybeName || maybePath.length)) {
      if (maybeId && !category.id) category.id = cleanText(maybeId);
      if (maybeName && !isRejectedMarketplaceName(maybeName) && !category.name) {
        category.name = maybeName;
      }
      if (maybePath.length > category.path.length) {
        category.path = uniqueNames(
          maybePath.filter((name) => !isRejectedMarketplaceName(name)),
        );
        if (!category.name) category.name = category.path[category.path.length - 1] || "";
      }
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (value && typeof value === "object") collectFromJson(value, key);
    });
  };

  document.querySelectorAll("script").forEach((script) => {
    const text = (script.textContent || "").trim();
    if (!text) return;
    const type = (script.getAttribute("type") || "").toLowerCase();
    const interesting =
      type.includes("ld+json") ||
      type.includes("application/json") ||
      /categoryId|categoryName|BreadcrumbList|primaryCategory/i.test(text);
    if (!interesting) return;

    const tryParse = (raw) => {
      try {
        collectFromJson(JSON.parse(raw));
        return true;
      } catch {
        return false;
      }
    };
    if (text.startsWith("{") || text.startsWith("[")) {
      tryParse(text);
      return;
    }
    const firstObj = text.search(/[{[]/);
    if (firstObj >= 0) {
      tryParse(text.slice(firstObj));
    }
  });

  if (!category.name && category.path.length) {
    category.name = category.path[category.path.length - 1] || "";
  }
  if (category.name && !category.path.length) {
    category.path = [category.name];
  }

  return { category, storeCategories: [] };
}

export async function getItemSpecifics(page) {
  return page.evaluate(extractListingSpecificsInPage);
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
          const heading = document.querySelector(
            'h1[data-testid="x-item-title-label"], .x-item-title__mainTitle, h1[itemprop="name"]',
          );
          const specs = document.querySelector(
            ".ux-labels-values, [data-testid='ux-labels-values'], .ux-layout-section--aspects",
          );
          const fitment = document.querySelector(
            ".motors-compatibility-table, [data-testid='d-motors-compatibility-table'], [data-testid='d-item-compatibility']",
          );
          return Boolean(heading || specs || fitment);
        },
        { timeout: 20000 },
      )
      .catch(() => undefined);
  }

  await wait(300);
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

  const title = await evaluate(extractListingTitleInPage, PARSER_SELECTORS);
  const images = await evaluate(extractListingImagesInPage, EBAY_SELECTORS);
  const itemSpecifics = await evaluate(extractListingSpecificsInPage);
  const categories = await evaluate(extractListingCategoriesInPage);
  const category = categories?.category || { id: "", name: "", path: [] };
  const storeCategories = [];

  console.log("[FetchEbayListing] item category", {
    id: category.id,
    name: category.name,
    path: category.path,
    pathText: Array.isArray(category.path) ? category.path.join(" > ") : "",
  });

  return {
    title: typeof title === "string" ? title.trim() : "",
    sku: "",
    price: "",
    images: Array.isArray(images) ? images : [],
    itemSpecifics: Array.isArray(itemSpecifics) ? itemSpecifics : [],
    category: {
      id: typeof category.id === "string" ? category.id : String(category.id || ""),
      name: typeof category.name === "string" ? category.name : "",
      path: Array.isArray(category.path) ? category.path.filter(Boolean) : [],
    },
    storeCategories,
    fitment: [],
    compatibility: [],
    compatibilityCount: 0,
  };
}
