export type ItemSpecific = {
  key: string;
  value: string;
};

const REJECTED_SPEC_KEYS = [
  /^see all/i,
  /^show more/i,
  /^read more/i,
  /^item specifics$/i,
  /^about this item$/i,
  /^about this product$/i,
  /^shipping$/i,
  /^delivery$/i,
  /^payments?$/i,
  /^returns?$/i,
  /^watch list$/i,
  /^item location$/i,
  /^located in$/i,
  /^handling time$/i,
  /^labels$/i,
  /^values$/i,
  /^was$/i,
  /^item price$/i,
  /^estimated total$/i,
  /^pickup$/i,
  /^buy it now/i,
  /^duration$/i,
  /^start time$/i,
  /^custom label$/i,
  /^seller notes$/i,
  /%\s*off/i,
  /^us\s*\$/i,
  /\$\d/,
];

const AUTOMOTIVE_SPEC_KEYS = [
  "Brand",
  "Manufacturer Part Number",
  "OE/OEM Part Number",
  "Other Part Number",
  "Interchange Part Number",
  "Type",
  "Manufacturer",
  "Placement on Vehicle",
  "Part Number",
  "Superseded Part Number",
  "Country/Region of Manufacture",
  "Performance Part",
  "Universal Fitment",
  "Vintage Part",
  "Modified Item",
  "Custom Bundle",
  "Condition",
  "Warranty",
  "Make",
  "Model",
  "Year",
  "Trim",
  "Engine",
  "Engine Size",
  "Engine Type",
  "Fuel Type",
  "Transmission",
  "Drive Type",
  "Body Style",
  "Doors",
  "Cylinders",
  "Vehicle Position",
  "Color",
  "Material",
  "Finish",
  "Features",
  "Mounting Hardware Included",
  "Items Included",
  "OE Specification",
  "Quantity",
  "Number in Pack",
  "Terminal Type",
  "Connector Type",
  "Voltage",
  "Amperage",
  "Wattage",
] as const;

const AUTOMOTIVE_KEY_ALIASES: Record<string, string> = {
  mpn: "Manufacturer Part Number",
  manufacturerpartnumber: "Manufacturer Part Number",
  oempartnumber: "OE/OEM Part Number",
  oepartnumber: "OE/OEM Part Number",
  oeoempartnumber: "OE/OEM Part Number",
  otherpartnumber: "Other Part Number",
  interchangepartnumber: "Interchange Part Number",
  supersededpartnumber: "Superseded Part Number",
  partnumber: "Part Number",
  countryoforigin: "Country/Region of Manufacture",
  countryofmanufacture: "Country/Region of Manufacture",
  countryregionofmanufacture: "Country/Region of Manufacture",
  manufacturerwarranty: "Warranty",
  placementonvehicle: "Placement on Vehicle",
  universalfitment: "Universal Fitment",
  performancepart: "Performance Part",
  vintagepart: "Vintage Part",
  modifieditem: "Modified Item",
  custombundle: "Custom Bundle",
  numberinpack: "Number in Pack",
  mountinghardwareincluded: "Mounting Hardware Included",
  itemsincluded: "Items Included",
  oespecification: "OE Specification",
  enginesize: "Engine Size",
  enginetype: "Engine Type",
  fueltype: "Fuel Type",
  drivetype: "Drive Type",
  bodystyle: "Body Style",
  vehicleposition: "Vehicle Position",
  terminaltype: "Terminal Type",
  connectortype: "Connector Type",
};

function compactSpecKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const AUTOMOTIVE_KEY_BY_COMPACT = new Map(
  AUTOMOTIVE_SPEC_KEYS.map((key) => [compactSpecKey(key), key]),
);

function canonicalizeSpecKey(key: string): string {
  const compact = compactSpecKey(key);
  return AUTOMOTIVE_KEY_ALIASES[compact] ?? AUTOMOTIVE_KEY_BY_COMPACT.get(compact) ?? key;
}

const EMBEDDED_SPEC_KEYS = [
  "nameValuePairs",
  "additionalProperty",
  "localizedAspects",
  "itemSpecifics",
  "aspects",
];

function cleanText(text: string | null | undefined): string {
  return (
    text
      ?.replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*\[?read more\]?\s*$/i, "")
      .replace(/:$/, "")
      .trim() || ""
  );
}

function isRejectedKey(key: string): boolean {
  return REJECTED_SPEC_KEYS.some((pattern) => pattern.test(key));
}

function isLikelySpecKey(key: string): boolean {
  const compact = compactSpecKey(key);
  if (AUTOMOTIVE_KEY_BY_COMPACT.has(compact) || compact in AUTOMOTIVE_KEY_ALIASES) {
    return true;
  }
  if (/^[a-z]+[A-Z]/.test(key)) {
    return false;
  }
  if (/^[_$]/.test(key)) {
    return false;
  }
  if (/^[a-z]+$/.test(key) && !/^(upc|ean|isbn|mpn|sku|oem)$/i.test(key)) {
    return false;
  }
  return true;
}

function addSpecific(
  specifics: ItemSpecific[],
  rawKey: string | null | undefined,
  rawValue: string | null | undefined,
): void {
  const key = canonicalizeSpecKey(cleanText(rawKey));
  let value = cleanText(rawValue);
  if (!key || !value || isRejectedKey(key) || !isLikelySpecKey(key) || key.length > 80) {
    return;
  }
  if (/^condition$/i.test(key) && value.length > 120) {
    const shortCondition = value.match(
      /^(new(?:\s+other)?|used|open box|refurbished|seller refurbished|manufacturer refurbished|for parts(?: or not working)?)/i,
    );
    value = shortCondition?.[0] ?? value.slice(0, 120).trim();
  }
  if (value.length > 300) {
    return;
  }

  const duplicate = specifics.some(
    (item) =>
      item.key.toLowerCase() === key.toLowerCase() &&
      item.value.toLowerCase() === value.toLowerCase(),
  );
  if (!duplicate) {
    specifics.push({ key, value });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sliceBalanced(text: string): string | null {
  const open = text[0];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) {
    return null;
  }

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
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, i + 1);
      }
    }
  }

  return null;
}

function nameFromRecord(record: Record<string, unknown>): string {
  const raw =
    record.name ??
    record.key ??
    record.label ??
    record.localizedAspectName ??
    record.localizedName ??
    record.Name;
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
}

function flattenValue(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") {
    return String(raw);
  }
  if (Array.isArray(raw)) {
    return raw.map(flattenValue).filter(Boolean).join(", ");
  }
  if (!isRecord(raw)) {
    return "";
  }
  return flattenValue(
    raw.localizedValue ?? raw.value ?? raw.content ?? raw.name ?? raw.Value,
  );
}

function valueFromRecord(record: Record<string, unknown>): string {
  if (record.values !== undefined) {
    return flattenValue(record.values);
  }
  return flattenValue(
    record.value ??
      record.content ??
      record.localizedValue ??
      record.localizedAspectValue ??
      record.Value,
  );
}

function looksLikeSpecificRecord(record: Record<string, unknown>, parentKey: string): boolean {
  const type = record["@type"];
  const parent = parentKey.toLowerCase();
  if (type === "PropertyValue") {
    return true;
  }
  if (Array.isArray(record.values) && nameFromRecord(record)) {
    return true;
  }
  return Boolean(
    nameFromRecord(record) &&
      valueFromRecord(record) &&
      /specific|aspect|namevalue|attribute|additionalproperty/.test(parent),
  );
}

function addFromRecord(
  specifics: ItemSpecific[],
  record: Record<string, unknown>,
  parentKey = "",
): void {
  if (!looksLikeSpecificRecord(record, parentKey)) {
    return;
  }
  const name = nameFromRecord(record);
  const value = valueFromRecord(record);
  if (name && value) {
    addSpecific(specifics, name, value);
  }
}

function scanObjectForSpecifics(
  obj: unknown,
  specifics: ItemSpecific[],
  parentKey = "",
): void {
  if (!obj || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => scanObjectForSpecifics(item, specifics, parentKey));
    return;
  }

  if (!isRecord(obj)) {
    return;
  }

  addFromRecord(specifics, obj, parentKey);

  const brand = obj.brand;
  if (parentKey === "" || parentKey.toLowerCase() === "product") {
    if (typeof brand === "string") {
      addSpecific(specifics, "Brand", brand);
    } else if (isRecord(brand) && (typeof brand.name === "string" || typeof brand.name === "number")) {
      addSpecific(specifics, "Brand", String(brand.name));
    }
  }

  Object.entries(obj).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    if (
      (lower.includes("specific") ||
        lower === "aspects" ||
        lower === "localizedaspects" ||
        lower === "namevaluepairs" ||
        lower === "additionalproperty") &&
      value &&
      typeof value === "object"
    ) {
      if (!Array.isArray(value) && isRecord(value)) {
        Object.entries(value).forEach(([specificKey, specificValue]) => {
          if (typeof specificValue === "string" || typeof specificValue === "number") {
            addSpecific(specifics, specificKey, String(specificValue));
          }
        });
      }
    }

    if (value && typeof value === "object") {
      scanObjectForSpecifics(value, specifics, key);
    }
  });
}

function parseScriptPayloads(text: string): unknown[] {
  const payloads: unknown[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return payloads;
  }

  const tryParse = (raw: string): boolean => {
    try {
      payloads.push(JSON.parse(raw) as unknown);
      return true;
    } catch {
      return false;
    }
  };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    if (tryParse(trimmed)) {
      return payloads;
    }
  }

  const firstObj = trimmed.search(/[{[]/);
  if (firstObj >= 0) {
    const sliced = sliceBalanced(trimmed.slice(firstObj));
    if (sliced) {
      tryParse(sliced);
    }
  }

  return payloads;
}

function extractJsonAfterKey(html: string, key: string): unknown[] {
  const results: unknown[] = [];
  const needle = `"${key}"`;
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const idx = html.indexOf(needle, searchFrom);
    if (idx === -1) {
      break;
    }
    searchFrom = idx + needle.length;
    const afterKey = html.slice(searchFrom).replace(/^\s*:\s*/, "");
    if (!afterKey.startsWith("{") && !afterKey.startsWith("[")) {
      continue;
    }
    const sliced = sliceBalanced(afterKey);
    if (!sliced) {
      continue;
    }
    try {
      results.push(JSON.parse(sliced) as unknown);
    } catch {
      // ignore invalid JSON slices
    }
    if (results.length >= 8) {
      break;
    }
  }

  return results;
}

export function extractItemSpecificsFromDocument(doc: Document): ItemSpecific[] {
  const specifics: ItemSpecific[] = [];

  const addFromLabelValue = (row: Element): void => {
    const label =
      row.querySelector(".ux-labels-values__labels-content") ??
      row.querySelector(".ux-labels-values__labels") ??
      row.querySelector('[class*="labels"]');
    const value =
      row.querySelector(".ux-labels-values__values-content") ??
      row.querySelector(".ux-labels-values__values") ??
      row.querySelector('[class*="values"]');
    addSpecific(specifics, label?.textContent, value?.textContent);
  };

  doc
    .querySelectorAll(
      "dl.ux-labels-values, .ux-labels-values, [data-testid='ux-labels-values'], .ux-layout-section-evo__col",
    )
    .forEach(addFromLabelValue);

  doc.querySelectorAll(".ux-layout-section-evo__row").forEach((row) => {
    row.querySelectorAll(".ux-labels-values, .ux-layout-section-evo__col").forEach(addFromLabelValue);
  });

  doc.querySelectorAll("dl").forEach((dl) => {
    const terms = dl.querySelectorAll("dt");
    const descriptions = dl.querySelectorAll("dd");
    terms.forEach((term, index) => {
      addSpecific(specifics, term.textContent, descriptions[index]?.textContent);
    });
  });

  return specifics;
}

export function extractSpecificsFromJSONFromDocument(doc: Document): ItemSpecific[] {
  const specifics: ItemSpecific[] = [];
  const scripts = doc.querySelectorAll("script");

  scripts.forEach((script) => {
    const text = script.textContent?.trim() ?? "";
    if (!text) {
      return;
    }

    const scriptType = (script.getAttribute("type") || "").toLowerCase();
    const isJsonScript =
      scriptType.includes("ld+json") || scriptType.includes("application/json");
    const looksEmbedded =
      /nameValuePairs|additionalProperty|itemSpecifics|localizedAspects|"aspects"/.test(text);

    if (!isJsonScript && !looksEmbedded) {
      return;
    }

    parseScriptPayloads(text).forEach((payload) => {
      scanObjectForSpecifics(payload, specifics);
    });

    EMBEDDED_SPEC_KEYS.forEach((key) => {
      extractJsonAfterKey(text, key).forEach((payload) => {
        scanObjectForSpecifics(payload, specifics, key);
      });
    });
  });

  const html = doc.documentElement?.innerHTML ?? "";
  if (html) {
    EMBEDDED_SPEC_KEYS.forEach((key) => {
      extractJsonAfterKey(html, key).forEach((payload) => {
        scanObjectForSpecifics(payload, specifics, key);
      });
    });
  }

  return specifics;
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  ).replace(/\\"/g, '"');
}

export function extractSpecificsFromHtmlText(html: string): ItemSpecific[] {
  const specifics: ItemSpecific[] = [];
  const decoded = html
    .replace(/\\u0022/gi, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  const labelValueRe =
    /ux-labels-values__labels[\s\S]{0,500}?ux-textspans[^>]*>([^<]{1,80})[\s\S]{0,800}?ux-labels-values__values[\s\S]{0,500}?ux-textspans[^>]*>([^<]{1,300})/gi;
  for (const match of decoded.matchAll(labelValueRe)) {
    addSpecific(specifics, match[1], match[2]);
  }

  const nameValuesRe =
    /"name"\s*:\s*"((?:\\.|[^"\\])+)"\s*,\s*"values"\s*:\s*(\[[^\]]*])/g;
  for (const match of decoded.matchAll(nameValuesRe)) {
    const key = unescapeJsonString(match[1] ?? "");
    try {
      const values = JSON.parse(match[2] ?? "[]") as unknown;
      addSpecific(specifics, key, flattenValue(values));
    } catch {
      // ignore invalid values arrays
    }
  }

  const nameValueRe =
    /"name"\s*:\s*"((?:\\.|[^"\\])+)"\s*,\s*"value"\s*:\s*"((?:\\.|[^"\\])+)"/g;
  for (const match of decoded.matchAll(nameValueRe)) {
    addSpecific(
      specifics,
      unescapeJsonString(match[1] ?? ""),
      unescapeJsonString(match[2] ?? ""),
    );
  }

  return specifics;
}

function uniqueSpecifics(allSpecifics: ItemSpecific[]): ItemSpecific[] {
  const unique: ItemSpecific[] = [];
  allSpecifics.forEach((item) => {
    if (!item.key || !item.value) return;
    const exists = unique.some(
      (existing) =>
        existing.key.toLowerCase() === item.key.toLowerCase() &&
        existing.value.toLowerCase() === item.value.toLowerCase(),
    );
    if (!exists) {
      unique.push(item);
    }
  });

  const preferredOrder = new Map(
    AUTOMOTIVE_SPEC_KEYS.map((key, index) => [compactSpecKey(key), index]),
  );
  unique.sort((left, right) => {
    const leftOrder = preferredOrder.get(compactSpecKey(left.key)) ?? AUTOMOTIVE_SPEC_KEYS.length;
    const rightOrder = preferredOrder.get(compactSpecKey(right.key)) ?? AUTOMOTIVE_SPEC_KEYS.length;
    return leftOrder - rightOrder;
  });
  return unique;
}

export function getItemSpecificsFromDocument(doc: Document): ItemSpecific[] {
  return uniqueSpecifics([
    ...extractItemSpecificsFromDocument(doc),
    ...extractSpecificsFromJSONFromDocument(doc),
    ...extractSpecificsFromHtmlText(doc.documentElement?.innerHTML ?? ""),
  ]);
}

export function getItemSpecificsFromHtml(html: string): ItemSpecific[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return uniqueSpecifics([
    ...getItemSpecificsFromDocument(doc),
    ...extractSpecificsFromHtmlText(html),
  ]);
}
