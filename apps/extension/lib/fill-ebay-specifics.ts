import type { ItemSpecific } from "./extract-listing-specifics.ts";

export type FillSpecificsResult = {
  filled: number;
  skipped: string[];
};

const KEY_ALIASES: Record<string, string> = {
  manufacturerpartnumber: "mpn",
  mpn: "mpn",
  countryofmanufacture: "countryoforigin",
  countryregionofmanufacture: "countryoforigin",
  manufacturerwarranty: "warranty",
  itemweight: "weight",
  itemwidth: "width",
  itemdepth: "depth",
  itemheight: "height",
  upc: "universalproductcode",
  oeoempartnumber: "oeoempartnumber",
  oempartnumber: "oeoempartnumber",
  placementonvehicle: "placementonvehicle",
  universalfitment: "universalfitment",
  numberinpack: "numberinpack",
  mountinghardwareincluded: "mountinghardwareincluded",
};

function compactKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function canonicalKey(key: string): string {
  const compact = compactKey(key);
  return KEY_ALIASES[compact] ?? compact;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setNativeValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement | HTMLTextAreaElement;
  const descriptor =
    Object.getOwnPropertyDescriptor(prototype, "value") ??
    Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    );

  descriptor?.set?.call(input, value);
  if (input.value !== value) {
    input.value = value;
  }

  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
}

function attributeRoot(): ParentNode {
  return document.querySelector(".summary__attributes") ?? document;
}

function fieldLabelText(field: Element): string {
  const label = field.querySelector(".summary__attributes--label");
  if (!label) {
    return "";
  }

  const clone = label.cloneNode(true);
  if (!(clone instanceof Element)) {
    return "";
  }

  clone.querySelectorAll(".tooltip__overlay").forEach((el) => el.remove());
  return (clone.textContent ?? "")
    .replace(/[~\-–]\s*[\d.,]+\s*[KMB]?\s*searches/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clippedValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): string {
  const maxLength = input.maxLength > 0 ? input.maxLength : value.length;
  return value.slice(0, maxLength);
}

function clickMatchingOption(field: Element, value: string): boolean {
  const options = field.querySelectorAll('[role="menuitemradio"], .menu__item');
  for (const option of options) {
    const optionText = (option.textContent ?? "").replace(/\s+/g, " ").trim();
    if (
      optionText.toLowerCase() === value.toLowerCase() ||
      canonicalKey(optionText) === canonicalKey(value)
    ) {
      if (option instanceof HTMLElement) {
        option.click();
        return true;
      }
    }
  }
  return false;
}

function fillAttributeField(field: Element, value: string): boolean {
  const namedInput = field.querySelector(
    'input[name^="attributes."], textarea[name^="attributes."]',
  );
  if (
    namedInput instanceof HTMLInputElement ||
    namedInput instanceof HTMLTextAreaElement
  ) {
    namedInput.focus();
    setNativeValue(namedInput, clippedValue(namedInput, value));
    namedInput.blur();
    return true;
  }

  const toggle = field.querySelector('button[name^="attributes."]');
  if (toggle instanceof HTMLElement) {
    toggle.click();
  }

  const searchInput = field.querySelector('input[name^="search-box-attributes"]');
  if (searchInput instanceof HTMLInputElement) {
    searchInput.focus();
    setNativeValue(searchInput, clippedValue(searchInput, value));
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    clickMatchingOption(field, value);
    searchInput.blur();
    return true;
  }

  const fallback = field.querySelector(
    "input.textbox__control, textarea.textbox__control, input[type='text'], textarea",
  );
  if (
    fallback instanceof HTMLInputElement ||
    fallback instanceof HTMLTextAreaElement
  ) {
    fallback.focus();
    setNativeValue(fallback, clippedValue(fallback, value));
    fallback.blur();
    return true;
  }

  return false;
}

function findAttributeFields(key: string): Element[] {
  const root = attributeRoot();
  const found: Element[] = [];
  const seen = new Set<Element>();
  const wanted = canonicalKey(key);

  function add(field: Element | null): void {
    if (field && !seen.has(field)) {
      seen.add(field);
      found.push(field);
    }
  }

  root.querySelectorAll('[data-testid="attribute"]').forEach((field) => {
    if (canonicalKey(fieldLabelText(field)) === wanted) {
      add(field);
    }
  });

  root.querySelectorAll("input, textarea, button").forEach((el) => {
    const name = el.getAttribute("name") ?? "";
    const aria = el.getAttribute("aria-label") ?? "";
    const attributeName = name.match(/^attributes\.(.+)$/)?.[1];
    const searchName = name.match(/^search-box-attributes(.+)$/)?.[1];
    const candidate = attributeName ?? searchName ?? aria;
    if (candidate && canonicalKey(candidate) === wanted) {
      add(el.closest('[data-testid="attribute"]') ?? el.parentElement);
    }
    if (wanted === "universalproductcode" && name === "universalProductCode") {
      add(el.closest('[data-testid="attribute"]') ?? el.parentElement);
    }
  });

  return found;
}

function existingRemoveAttributeButtons(root: ParentNode): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll(
      'button[aria-label*="Remove"][aria-label*="attribute"], button[aria-label^="Remove "][aria-label$=" attribute"]',
    ),
  ).filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
}

async function confirmAttributeDialogIfNeeded(): Promise<void> {
  const dialog = document.querySelector(
    '.lightbox-dialog:not([hidden]) button.btn--primary, [role="dialog"]:not([hidden]) button.btn--primary',
  );
  if (dialog instanceof HTMLButtonElement) {
    dialog.click();
    await delay(80);
  }
}

async function removeOptionalAttributes(root: ParentNode): Promise<void> {
  for (let guard = 0; guard < 40; guard += 1) {
    const buttons = existingRemoveAttributeButtons(root);
    const last = buttons[buttons.length - 1];
    if (!last) {
      break;
    }
    last.click();
    await confirmAttributeDialogIfNeeded();
    await delay(90);
  }
}

function selectedDropdownText(field: Element): string {
  return (field.querySelector(".se-expand-button__button-text")?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function clearAttributeField(field: Element): Promise<void> {
  const named = field.querySelector(
    'input[name^="attributes."], textarea[name^="attributes."]',
  );
  if (named instanceof HTMLInputElement || named instanceof HTMLTextAreaElement) {
    if (named.value) {
      named.focus();
      setNativeValue(named, "");
      named.blur();
    }
  }

  const search = field.querySelector('input[name^="search-box-attributes"]');
  if (search instanceof HTMLInputElement && search.value) {
    search.focus();
    setNativeValue(search, "");
    search.blur();
  }

  const toggle = field.querySelector('button[name^="attributes."]');
  const selected = selectedDropdownText(field);
  if (toggle instanceof HTMLElement && selected) {
    toggle.click();
    await delay(80);
    const clearBtn = field.querySelector("button.se-filter-menu-button__clear");
    if (clearBtn instanceof HTMLElement) {
      clearBtn.click();
    } else {
      field.querySelectorAll('[role="menuitemradio"][aria-checked="true"]').forEach((option) => {
        if (option instanceof HTMLElement) {
          option.click();
        }
      });
    }
    if (toggle.getAttribute("aria-expanded") === "true") {
      toggle.click();
    }
    await delay(50);
  }

  const fallback = field.querySelector(
    "input.textbox__control, textarea.textbox__control, input[type='text'], textarea",
  );
  if (
    (fallback instanceof HTMLInputElement || fallback instanceof HTMLTextAreaElement) &&
    fallback.value &&
    fallback !== named &&
    fallback !== search
  ) {
    fallback.focus();
    setNativeValue(fallback, "");
    fallback.blur();
  }
}

async function clearRemainingAttributeFields(root: ParentNode): Promise<void> {
  const fields = root.querySelectorAll('[data-testid="attribute"]');
  for (const field of fields) {
    await clearAttributeField(field);
  }

  const upc = root.querySelector('input[name="universalProductCode"]');
  if (upc instanceof HTMLInputElement && upc.value) {
    upc.focus();
    setNativeValue(upc, "");
    upc.blur();
  }
}

async function replaceExistingSpecifics(): Promise<void> {
  const root = attributeRoot();
  expandHiddenAttributes(root);
  await delay(120);
  await removeOptionalAttributes(root);
  await clearRemainingAttributeFields(root);
  await delay(120);
}

function expandHiddenAttributes(root: ParentNode): void {
  root.querySelectorAll("button, a, [role='button']").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (/^(show more|see more|see all|more item specifics)/i.test(text)) {
      if (el instanceof HTMLElement) {
        el.click();
      }
    }
  });
}

function findAddSpecificInput(root: ParentNode): HTMLInputElement | null {
  const inputs = root.querySelectorAll("input[type='text'], input:not([type]), input.textbox__control");
  for (const input of inputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    const name = input.name || "";
    const placeholder = input.placeholder || "";
    const aria = input.getAttribute("aria-label") || "";
    const haystack = `${name} ${placeholder} ${aria}`.toLowerCase();
    if (
      /unused/.test(haystack) ||
      /add( an)?( your own)? item specific/.test(haystack) ||
      /search (for )?(an )?item specific/.test(haystack) ||
      /select item specific/.test(haystack)
    ) {
      return input;
    }
  }
  return null;
}

function clickAddSpecificButton(root: ParentNode): boolean {
  const controls = root.querySelectorAll("button, a, [role='button']");
  for (const el of controls) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (/^add( your own)?( an)? item specific/i.test(text) && el instanceof HTMLElement) {
      el.click();
      return true;
    }
  }
  return false;
}

async function addAndFillMissingSpecific(spec: ItemSpecific): Promise<boolean> {
  const root = attributeRoot();
  clickAddSpecificButton(root);
  await delay(200);

  const addInput = findAddSpecificInput(root);
  if (!addInput) {
    return false;
  }

  addInput.focus();
  setNativeValue(addInput, spec.key);
  addInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
  );
  const optionRoot =
    addInput.closest(".fake-menu-button") ??
    addInput.closest('[data-testid="menu-container"]') ??
    (root instanceof Element ? root : document.body);
  clickMatchingOption(optionRoot, spec.key);
  await delay(350);

  const fields = findAttributeFields(spec.key);
  if (fields.length === 0) {
    return false;
  }

  return fields.some((field) => fillAttributeField(field, spec.value));
}

function fillExistingSpecific(spec: ItemSpecific): boolean {
  const fields = findAttributeFields(spec.key);
  if (fields.length === 0) {
    return false;
  }
  return fields.some((field) => fillAttributeField(field, spec.value));
}

export async function fillEbayListingSpecifics(
  specifics: ItemSpecific[],
): Promise<FillSpecificsResult> {
  await replaceExistingSpecifics();

  const skipped: string[] = [];
  let filled = 0;

  for (const spec of specifics) {
    if (fillExistingSpecific(spec)) {
      filled += 1;
      continue;
    }

    const added = await addAndFillMissingSpecific(spec);
    if (added) {
      filled += 1;
    } else {
      skipped.push(spec.key);
    }
  }

  return { filled, skipped };
}
