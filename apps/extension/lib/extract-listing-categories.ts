export type ListingCategory = {
  id: string;
  name: string;
  path: string[];
};

export type StoreCategory = {
  name: string;
  id?: string;
  path?: string[];
};

export type ListingCategories = {
  category: ListingCategory;
  storeCategories: StoreCategory[];
};

const ITEM_CATEGORY_SELECTORS = [
  '[data-testid="breadcrumbs"] a',
  '[data-testid="x-breadcrumb"] a',
  "nav[aria-label*='breadcrumb' i] a",
  "nav.breadcrumbs a",
  ".seo-breadcrumb a",
  ".breadcrumbs a",
  "ol.breadcrumb a",
  ".x-breadcrumb a",
  ".ux-section-breadcrumbs a",
  '[class*="breadcrumb"] a',
];

const STORE_CATEGORY_SELECTORS = [
  '[data-testid*="store-categor"] a',
  '[data-testid="x-store-information"] a',
  ".x-store-information a",
  ".str-categories a",
  ".store-categories a",
  '[class*="store-categor"] a',
  '[class*="storeCategories"] a',
  'a[href*="/str/"]',
  'a[href*="storecat"]',
  'a[href*="_storecat"]',
];

function cleanText(text: string | null | undefined): string {
  return (
    text
      ?.replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim() || ""
  );
}

function emptyCategory(): ListingCategory {
  return { id: "", name: "", path: [] };
}

function isRejectedMarketplaceName(name: string): boolean {
  return /^(home|ebay|back to search|all categories|see all|shop by category)$/i.test(
    name,
  );
}

function isRejectedStoreName(name: string): boolean {
  return /^(home|ebay|see all|visit store|seller information|feedback|contact)$/i.test(
    name,
  );
}

function isStoreHref(href: string): boolean {
  return (
    /\/str\//i.test(href) ||
    /stores\.ebay\./i.test(href) ||
    /[?&]_ssn=/i.test(href) ||
    /[?&]storecat=/i.test(href) ||
    /[?&]_storecat=/i.test(href) ||
    /[?&]_sc=1/i.test(href)
  );
}

function categoryIdFromHref(href: string): string {
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
}

function storeCategoryIdFromHref(href: string): string {
  if (!href) return "";
  const storecat = href.match(/[?&](?:storecat|_storecat|_sacat)=(\d+)/i);
  return storecat?.[1] ?? "";
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? cleanText(String(value))
    : "";
}

function sliceBalanced(text: string): string | null {
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
}

function parseScriptPayloads(text: string): unknown[] {
  const payloads: unknown[] = [];
  const trimmed = text.trim();
  const tryParse = (raw: string): boolean => {
    try {
      payloads.push(JSON.parse(raw) as unknown);
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
}

function collectFromJson(
  obj: unknown,
  category: ListingCategory,
  storeCategories: StoreCategory[],
  parentKey = "",
): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectFromJson(item, category, storeCategories, parentKey));
    return;
  }
  if (!isRecord(obj)) return;

  const parent = parentKey.toLowerCase();
  const type = stringValue(obj["@type"]);

  if (type === "BreadcrumbList" || parent.includes("breadcrumb")) {
    const elements = Array.isArray(obj.itemListElement) ? obj.itemListElement : [];
    const names = elements
      .map((item) => {
        if (!isRecord(item)) return { name: "", href: "" };
        const href = isRecord(item.item)
          ? stringValue(item.item["@id"] ?? item.item.id ?? item.item.url)
          : stringValue(item.item);
        return { name: stringValue(item.name), href };
      })
      .filter(
        (entry) =>
          entry.name && !isRejectedMarketplaceName(entry.name) && !isStoreHref(entry.href),
      );
    if (names.length > category.path.length) {
      category.path = names.map((entry) => entry.name);
      category.name = names[names.length - 1]?.name ?? category.name;
      const lastWithId = [...names]
        .reverse()
        .find((entry) => categoryIdFromHref(entry.href));
      if (lastWithId && !category.id) {
        category.id = categoryIdFromHref(lastWithId.href);
      }
    }
  }

  if (typeof obj.category === "string" && !parent.includes("store")) {
    const parts = obj.category
      .split(/>|\/|\|/)
      .map((part) => cleanText(part))
      .filter((part) => part && !isRejectedMarketplaceName(part));
    if (parts.length > category.path.length) {
      category.path = uniqueNames(parts);
      category.name = category.path[category.path.length - 1] ?? category.name;
    }
  }

  const maybeId =
    stringValue(obj.categoryId) ||
    stringValue(obj.categoryID) ||
    stringValue(obj.leafCategoryId) ||
    stringValue(obj.primaryCategoryId) ||
    (isRecord(obj.primaryCategory) ? stringValue(obj.primaryCategory.categoryId ?? obj.primaryCategory.id) : "");
  const maybeName =
    stringValue(obj.categoryName) ||
    stringValue(obj.primaryCategoryName) ||
    (isRecord(obj.primaryCategory)
      ? stringValue(obj.primaryCategory.categoryName ?? obj.primaryCategory.name)
      : "") ||
    (parent.includes("category") && !parent.includes("store") ? stringValue(obj.name) : "");
  const maybePath = Array.isArray(obj.categoryPath)
    ? obj.categoryPath.map(stringValue).filter(Boolean)
    : typeof obj.categoryPath === "string"
      ? obj.categoryPath.split(/>|\/|\|/).map(cleanText).filter(Boolean)
      : [];

  if (!parent.includes("store") && (maybeId || maybeName || maybePath.length)) {
    if (maybeId && !category.id) category.id = maybeId;
    if (maybeName && !isRejectedMarketplaceName(maybeName)) {
      if (!category.name) category.name = maybeName;
    }
    if (maybePath.length > category.path.length) {
      category.path = uniqueNames(maybePath.filter((name) => !isRejectedMarketplaceName(name)));
      if (!category.name) category.name = category.path[category.path.length - 1] ?? "";
    }
  }

  const storeName =
    stringValue(obj.storeCategoryName) ||
    stringValue(obj.storeCategory2Name) ||
    (parent.includes("store") && parent.includes("categor") ? stringValue(obj.name) : "");
  const storeId =
    stringValue(obj.storeCategoryId) ||
    stringValue(obj.storeCategory2Id) ||
    stringValue(obj.storeCategoryID);
  if (storeName && !isRejectedStoreName(storeName)) {
    const exists = storeCategories.some(
      (item) => item.name.toLowerCase() === storeName.toLowerCase(),
    );
    if (!exists) {
      const entry: StoreCategory = { name: storeName };
      if (storeId) entry.id = storeId;
      storeCategories.push(entry);
    }
  }

  Object.entries(obj).forEach(([key, value]) => {
    if (value && typeof value === "object") {
      collectFromJson(value, category, storeCategories, key);
    }
  });
}

function extractMarketplaceFromDom(doc: Document): ListingCategory {
  const category = emptyCategory();
  const path: { name: string; href: string }[] = [];

  for (const selector of ITEM_CATEGORY_SELECTORS) {
    const links = doc.querySelectorAll(selector);
    if (!links.length) continue;
    links.forEach((link) => {
      const name = cleanText(link.textContent);
      const href = link instanceof HTMLAnchorElement ? link.href : link.getAttribute("href") || "";
      if (!name || isRejectedMarketplaceName(name) || isStoreHref(href)) return;
      path.push({ name, href });
    });
    if (path.length) break;
  }

  if (!path.length) {
    doc.querySelectorAll("a").forEach((link) => {
      const href = link.href || "";
      const name = cleanText(link.textContent);
      if (!name || isRejectedMarketplaceName(name) || isStoreHref(href)) return;
      if (categoryIdFromHref(href)) {
        path.push({ name, href });
      }
    });
  }

  const uniquePath = uniqueNames(path.map((entry) => entry.name));
  if (uniquePath.length) {
    category.path = uniquePath;
    category.name = uniquePath[uniquePath.length - 1] ?? "";
    const lastWithId = [...path].reverse().find((entry) => categoryIdFromHref(entry.href));
    category.id = lastWithId ? categoryIdFromHref(lastWithId.href) : "";
  }

  return category;
}

function extractStoreFromDom(doc: Document): StoreCategory[] {
  const storeCategories: StoreCategory[] = [];

  const addStore = (name: string, href = ""): void => {
    const cleaned = cleanText(name);
    if (!cleaned || isRejectedStoreName(cleaned) || isRejectedMarketplaceName(cleaned)) return;
    if (categoryIdFromHref(href) && !isStoreHref(href)) return;
    const exists = storeCategories.some(
      (item) => item.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (exists) return;
    const entry: StoreCategory = { name: cleaned };
    const id = storeCategoryIdFromHref(href);
    if (id) entry.id = id;
    storeCategories.push(entry);
  };

  for (const selector of STORE_CATEGORY_SELECTORS) {
    doc.querySelectorAll(selector).forEach((link) => {
      const href = link instanceof HTMLAnchorElement ? link.href : link.getAttribute("href") || "";
      addStore(link.textContent ?? "", href);
    });
  }

  doc.querySelectorAll("a[href*='/str/'], a[href*='storecat'], a[href*='_storecat']").forEach((link) => {
    const href = link instanceof HTMLAnchorElement ? link.href : link.getAttribute("href") || "";
    addStore(link.textContent ?? "", href);
  });

  return storeCategories;
}

export function getListingCategoriesFromDocument(doc: Document): ListingCategories {
  const category = extractMarketplaceFromDom(doc);
  const storeCategories = extractStoreFromDom(doc);

  doc.querySelectorAll("script").forEach((script) => {
    const text = script.textContent?.trim() ?? "";
    if (!text) return;
    const type = (script.getAttribute("type") || "").toLowerCase();
    const interesting =
      type.includes("ld+json") ||
      type.includes("application/json") ||
      /categoryId|categoryName|storeCategory|BreadcrumbList|primaryCategory/i.test(text);
    if (!interesting) return;
    parseScriptPayloads(text).forEach((payload) => {
      collectFromJson(payload, category, storeCategories);
    });
  });

  if (!category.name && category.path.length) {
    category.name = category.path[category.path.length - 1] ?? "";
  }
  if (category.name && !category.path.length) {
    category.path = [category.name];
  }

  return { category, storeCategories };
}

export function getListingCategoriesFromHtml(html: string): ListingCategories {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return getListingCategoriesFromDocument(doc);
}
