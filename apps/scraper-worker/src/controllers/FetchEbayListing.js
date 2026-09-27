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

  return {
    title: "",
    sku: "",
    price: "",
    images: [],
    itemSpecifics: Array.isArray(itemSpecifics) ? itemSpecifics : [],
    condition: "",
    conditionDescription: "",
    description: "",
    category: { id: "", name: "", path: [] },
    storeCategories: [],
    shipping: { service: "", cost: "", handlingTime: "", location: "", details: "" },
    weight: { value: "", unit: "" },
    dimensions: { length: "", width: "", height: "", unit: "", raw: "" },
    fitment: [],
    compatibility: [],
    compatibilityCount: 0,
  };
}
