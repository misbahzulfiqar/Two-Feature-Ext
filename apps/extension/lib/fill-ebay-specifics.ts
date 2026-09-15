import type { ItemSpecific } from "@sell-similar/contracts";
import {
  FILL_ITEM_CUSTOM,
  FILL_ITEM_YES_NO,
  type FillItemCustomResponse,
  type FillItemYesNoResponse,
} from "./specifics-messages.ts";

export type FillSpecificsResult = {
  filled: number;
  skipped: string[];
};

function compactKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const ALWAYS_NO_SPECIFICS: ItemSpecific[] = [
  { key: "Performance Part", value: "No" },
  { key: "Vintage Part", value: "No" },
  { key: "Universal Fitment", value: "No" },
];

function isAlwaysNoSpecific(key: string): boolean {
  const wanted = compactKey(key);
  return ALWAYS_NO_SPECIFICS.some((spec) => compactKey(spec.key) === wanted);
}

function isSchemaClassValue(value: string): boolean {
  return /^[A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+$/.test(value.trim());
}

function isJsonLdTypeSpecific(spec: ItemSpecific): boolean {
  if (compactKey(spec.key) !== "type") {
    return false;
  }
  return (
    isSchemaClassValue(spec.value) ||
    /^(PriceSpecification|UnitPriceSpecification|CompoundPriceSpecification|Offer|AggregateOffer|Product|Brand|Organization)$/i.test(
      spec.value.trim(),
    )
  );
}

function canonicalKey(key: string): string {
  return compactKey(key);
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

function specificValues(value: string): string[] {
  return value
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitSearchBoxValues(value: string, maxLength: number): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const parts = specificValues(trimmed);
  const chunks: string[] = [];

  for (const part of parts) {
    if (part.length <= maxLength) {
      chunks.push(part);
      continue;
    }
    for (let index = 0; index < part.length; index += maxLength) {
      chunks.push(part.slice(index, index + maxLength));
    }
  }
  return chunks;
}

function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function optionLabel(option: Element): string {
  const aria = option.getAttribute("aria-label") ?? "";
  if (aria && aria.length < 80) {
    return aria.replace(/\s+/g, " ").trim();
  }
  const text = (option.textContent ?? "").trim();
  return (text.split("\n")[0] ?? "").replace(/\s+/g, " ").trim();
}

function optionMatchesValue(option: Element, value: string): boolean {
  const wanted = canonicalKey(value);
  if (!wanted) return false;
  const label = optionLabel(option);
  const compactLabel = canonicalKey(label);
  return compactLabel === wanted || compactLabel.replace(/seedetails/g, "") === wanted;
}

function visibleMenuOptions(): HTMLElement[] {
  const nodes = document.querySelectorAll(
    '[role="option"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="menuitem"], .menu__item, .listbox__option, .listbox-button__option',
  );
  return [...nodes].filter((node): node is HTMLElement => node instanceof HTMLElement && isShown(node));
}

function clickMatchingOption(field: Element, value: string): boolean {
  const local = field.querySelectorAll(
    '[role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], .menu__item, .listbox__option',
  );
  const candidates = [...local, ...visibleMenuOptions()];
  let best: HTMLElement | null = null;
  let bestSize = Infinity;
  const seen = new Set<HTMLElement>();
  for (const option of candidates) {
    if (!(option instanceof HTMLElement) || seen.has(option)) continue;
    seen.add(option);
    if (!optionMatchesValue(option, value)) continue;
    const label = optionLabel(option);
    if (label.length < bestSize) {
      best = option;
      bestSize = label.length;
    }
  }
  if (!best) return false;
  if (
    best.getAttribute("aria-selected") === "true" ||
    best.getAttribute("aria-checked") === "true" ||
    best.querySelector("input:checked")
  ) {
    return true;
  }
  fireClick(best);
  return true;
}

function fireClick(el: HTMLElement): void {
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
  el.click();
}

function normalizeYesNo(value: string): "yes" | "no" | null {
  const trimmed = value.trim().toLowerCase();
  if (/^(yes|true)\b/.test(trimmed)) {
    return "yes";
  }
  if (/^(no|false)\b/.test(trimmed)) {
    return "no";
  }
  return null;
}

function attributeValueRoot(field: Element): Element {
  return field.querySelector(".summary__attributes--value") ?? field;
}

function yesNoPillSelected(pill: HTMLElement): boolean {
  const radio = pill.querySelector("input[type='radio']");
  if (radio instanceof HTMLInputElement && radio.checked) {
    return true;
  }
  return (
    pill.getAttribute("aria-pressed") === "true" ||
    pill.getAttribute("aria-checked") === "true" ||
    pill.getAttribute("aria-selected") === "true" ||
    pill.className.toLowerCase().includes("selected") ||
    pill.className.toLowerCase().includes("pressed")
  );
}

function clickYesNo(field: Element, value: string): boolean {
  const wanted = normalizeYesNo(value);
  if (!wanted) {
    return false;
  }

  const root = attributeValueRoot(field);

  const pills = root.querySelectorAll(".filter-button, button.filter-button, label.filter-button");
  for (const pill of pills) {
    if (!(pill instanceof HTMLElement) || !isShown(pill)) {
      continue;
    }
    const labeled = (pill.querySelector(".filter-button__text")?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const text = labeled || (pill.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (text !== wanted && !new RegExp(`^${wanted}$`).test(labeled)) {
      continue;
    }
    if (yesNoPillSelected(pill)) {
      return true;
    }
    fireClick(pill);
    return true;
  }

  const radios = root.querySelectorAll('input[type="radio"]');
  for (const radio of radios) {
    if (!(radio instanceof HTMLInputElement)) {
      continue;
    }
    const haystack = [
      radio.value,
      radio.getAttribute("aria-label") ?? "",
      radio.labels?.[0]?.textContent ?? "",
      radio.closest("label")?.textContent ?? "",
      radio.parentElement?.textContent ?? "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (normalizeYesNo(haystack) !== wanted && radio.value.trim().toLowerCase() !== wanted) {
      continue;
    }
    if (radio.checked) {
      return true;
    }
    fireClick(radio);
    radio.checked = true;
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const exact: HTMLElement[] = [];
  root.querySelectorAll("button, [role='button'], [role='radio'], [role='option'], label, a, span, div").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (text === wanted) {
      exact.push(node);
    }
  });
  exact.sort((left, right) => left.textContent!.length - right.textContent!.length);
  const match = exact[0];
  if (!match) {
    return false;
  }

  const clickable =
    match.closest("button, label, a, [role='button'], [role='radio'], [role='option']") ?? match;
  if (!(clickable instanceof HTMLElement)) {
    return false;
  }
  fireClick(clickable);
  const nested = clickable.querySelector("input[type='radio'], input[type='checkbox']");
  if (nested instanceof HTMLInputElement) {
    nested.checked = true;
    nested.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

async function fillSearchBoxValues(
  field: Element,
  searchInput: HTMLInputElement,
  value: string,
): Promise<boolean> {
  const toggle = field.querySelector('button[name^="attributes."]');
  if (toggle instanceof HTMLElement && toggle.getAttribute("aria-expanded") !== "true") {
    fireClick(toggle);
    await delay(150);
  }

  const limit = searchInput.maxLength > 0 ? searchInput.maxLength : 65;
  const chunks = splitSearchBoxValues(value, limit);
  if (chunks.length === 0) {
    return false;
  }

  let any = false;
  for (const chunk of chunks) {
    if (fieldHasValue(field, chunk)) {
      any = true;
      continue;
    }
    searchInput.focus();
    setNativeValue(searchInput, "");
    setNativeValue(searchInput, chunk);
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
    searchInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
    await delay(180);
    clickMatchingOption(field, chunk);
    any = true;
    await delay(120);
    setNativeValue(searchInput, "");
  }

  if (toggle instanceof HTMLElement && toggle.getAttribute("aria-expanded") === "true") {
    fireClick(toggle);
  }
  searchInput.blur();
  return any;
}

function comboboxInput(field: Element): HTMLInputElement | null {
  const named = field.querySelector('input[name^="search-box-attributes"]');
  if (named instanceof HTMLInputElement && isShown(named)) return named;
  const inField = field.querySelector(
    "input.textbox__control, input[type='text']:not([type='hidden'])",
  );
  if (inField instanceof HTMLInputElement && isShown(inField)) return inField;
  for (const input of document.querySelectorAll(
    '.listbox input, [role="listbox"] input, .menu input, .se-filter-menu input, .lightbox-dialog input.textbox__control',
  )) {
    if (input instanceof HTMLInputElement && isShown(input) && input.type !== "hidden") {
      return input;
    }
  }
  return null;
}

async function fillAttributeField(field: Element, value: string): Promise<boolean> {
  if (clickYesNo(field, value)) {
    await delay(80);
    return true;
  }

  const toggle = field.querySelector<HTMLElement>('button[name^="attributes."], button.listbox-button__control, button.se-expand-button');
  if (toggle && isShown(toggle) && toggle.getAttribute("aria-expanded") !== "true") {
    fireClick(toggle);
    await delay(180);
  }

  if (clickMatchingOption(field, value) || clickYesNo(field, value)) {
    if (toggle instanceof HTMLElement && toggle.getAttribute("aria-expanded") === "true") {
      fireClick(toggle);
    }
    return true;
  }

  const searchInput = comboboxInput(field);
  if (searchInput) {
    return fillSearchBoxValues(field, searchInput, value);
  }

  const namedInput = field.querySelector(
    'input[name^="attributes."]:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), textarea[name^="attributes."]',
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
      add(el.closest('[data-testid="attribute"]') ?? el.closest(".summary__attributes--value")?.parentElement ?? el.parentElement);
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
    const buttons = existingRemoveAttributeButtons(root).filter((button) => {
      const field = button.closest('[data-testid="attribute"]');
      return !(field && isAlwaysNoSpecific(fieldLabelText(field)));
    });
    const last = buttons[buttons.length - 1];
    if (!last) {
      break;
    }
    last.click();
    await confirmAttributeDialogIfNeeded();
    await delay(90);
  }
}

function fieldHasValue(field: Element, value: string): boolean {
  const parts = specificValues(value);
  if (parts.length === 0) return false;
  const selected = canonicalKey(selectedDropdownText(field));
  const chips = canonicalKey(field.textContent ?? "");
  const inputValues = [...field.querySelectorAll("input, textarea")]
    .map((input) =>
      input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
        ? canonicalKey(input.value)
        : "",
    )
    .join("");
  const haystack = `${selected}${chips}${inputValues}`;
  return parts.every((part) => {
    const wanted = canonicalKey(part);
    if (!wanted) return false;
    return (
      selected === wanted ||
      selected.includes(wanted) ||
      inputValues === wanted ||
      (wanted.length >= 2 && haystack.includes(wanted))
    );
  });
}

function selectedDropdownText(field: Element): string {
  return (field.querySelector(".se-expand-button__button-text")?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** React tracks radio state, so the checked flag must go through its setter. */
function setNativeChecked(input: HTMLInputElement, checked: boolean): void {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const descriptor =
    Object.getOwnPropertyDescriptor(prototype, "checked") ??
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
  descriptor?.set?.call(input, checked);
  if (input.checked !== checked) {
    input.checked = checked;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * eBay renders the open dropdown panel outside the attribute row, so its
 * "Clear" control has to be found document-wide. Our own panel lives in a
 * shadow root and is invisible to these queries.
 */
function visibleClearControl(): HTMLElement | null {
  const direct = document.querySelector(
    "button.se-filter-menu-button__clear, button.filter-menu__clear, .se-filter-menu__clear",
  );
  if (direct instanceof HTMLElement && isShown(direct)) {
    return direct;
  }
  const candidates = document.querySelectorAll('button, a, [role="button"]');
  for (const node of candidates) {
    if (!(node instanceof HTMLElement) || !isShown(node)) continue;
    if (node.closest("[data-sell-similar-assistant]")) continue;
    const text = (node.textContent ?? "").replace(/s+/g, " ").trim();
    if (/^clear( all)?$/i.test(text)) {
      return node;
    }
  }
  return null;
}

/** Deselect a Yes/No pill pair. */
async function clearYesNoField(field: Element): Promise<boolean> {
  const root = attributeValueRoot(field);
  const radios = [...root.querySelectorAll('input[type="radio"]')].filter(
    (node): node is HTMLInputElement => node instanceof HTMLInputElement,
  );
  if (radios.length === 0) {
    return false;
  }
  const checked = radios.find((radio) => radio.checked);
  if (!checked) {
    return true;
  }

  // Clicking the selected pill is how a person deselects it.
  const pill = checked.closest("label") ?? checked.parentElement ?? checked;
  if (pill instanceof HTMLElement) {
    fireClick(pill);
    await delay(140);
  }
  if (!radios.some((radio) => radio.checked)) {
    return true;
  }

  // Some pills re-select instead of toggling; clear the group directly.
  for (const radio of radios) {
    if (radio.checked) {
      setNativeChecked(radio, false);
    }
  }
  await delay(120);
  return !radios.some((radio) => radio.checked);
}

/** Empty a dropdown using eBay's own Clear control. */
async function clearDropdownField(field: Element): Promise<boolean> {
  const toggle =
    field.querySelector('button[name^="attributes."]') ??
    field.querySelector("button[aria-haspopup], button[aria-expanded]");
  if (!(toggle instanceof HTMLElement)) {
    return false;
  }
  if (!selectedDropdownText(field)) {
    return true;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (toggle.getAttribute("aria-expanded") !== "true") {
      fireClick(toggle);
      await delay(220);
    }

    const clear = visibleClearControl();
    if (clear) {
      fireClick(clear);
      await delay(200);
    } else {
      const checkedOptions = document.querySelectorAll(
        '[role="menuitemradio"][aria-checked="true"], [role="menuitemcheckbox"][aria-checked="true"], [role="option"][aria-selected="true"]',
      );
      for (const option of checkedOptions) {
        if (option instanceof HTMLElement && isShown(option)) {
          fireClick(option);
          await delay(120);
        }
      }
    }

    if (toggle.getAttribute("aria-expanded") === "true") {
      fireClick(toggle);
      await delay(160);
    }

    if (!selectedDropdownText(field)) {
      return true;
    }
  }
  return !selectedDropdownText(field);
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

  await clearYesNoField(field);
  await clearDropdownField(field);

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

/** True when the attribute row still shows a value of any kind. */
function attributeFieldHasValue(field: Element): boolean {
  if (selectedDropdownText(field)) {
    return true;
  }
  const valueRoot = attributeValueRoot(field);
  for (const node of valueRoot.querySelectorAll('input[type="radio"]')) {
    if (node instanceof HTMLInputElement && node.checked) {
      return true;
    }
  }
  const text = field.querySelector(
    'input[name^="attributes."], textarea[name^="attributes."]',
  );
  if (
    (text instanceof HTMLInputElement || text instanceof HTMLTextAreaElement) &&
    text.value.trim()
  ) {
    return true;
  }
  return false;
}

async function clearRemainingAttributeFields(root: ParentNode): Promise<void> {
  for (const field of root.querySelectorAll('[data-testid="attribute"]')) {
    if (isAlwaysNoSpecific(fieldLabelText(field))) {
      continue;
    }
    await clearAttributeField(field);
  }

  // eBay re-renders rows as they clear, so sweep again for stragglers.
  for (let pass = 0; pass < 2; pass += 1) {
    const remaining = [...root.querySelectorAll('[data-testid="attribute"]')].filter(
      (field) => attributeFieldHasValue(field) && !isAlwaysNoSpecific(fieldLabelText(field)),
    );
    if (remaining.length === 0) {
      break;
    }
    for (const field of remaining) {
      await clearAttributeField(field);
    }
  }

  const stillSet = [...root.querySelectorAll('[data-testid="attribute"]')].filter(
    (field) => attributeFieldHasValue(field) && !isAlwaysNoSpecific(fieldLabelText(field)),
  );
  if (stillSet.length > 0) {
    console.warn(
      "[SellSimilar][specifics] could not clear " + stillSet.length + " field(s)",
      stillSet.map((field) => fieldLabelText(field)),
    );
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
  await expandHiddenAttributes(root);
  await delay(120);
  await removeOptionalAttributes(root);
  await clearRemainingAttributeFields(root);
  await delay(120);
}

export async function clearEbayListingSpecifics(): Promise<void> {
  await replaceExistingSpecifics();
}

function specificKeysToFill(spec: ItemSpecific): string[] {
  const key = spec.key.trim();
  if (!key) return [];
  const compact = compactKey(key);
  if (compact === "brand" || compact === "partbrand") {
    return ["Part Brand", "Brand"];
  }
  return [key];
}

function shouldSkipSpecific(spec: ItemSpecific): boolean {
  const key = compactKey(spec.key);
  if (
    key === "condition" ||
    key === "sellernotes" ||
    key === "category" ||
    key === "itemcategory" ||
    key === "itemspecifics" ||
    key === "listprice" ||
    key === "compatibility" ||
    key === "seecompatiblevehicles" ||
    key === "freeshipping" ||
    key === "returnsaccepted" ||
    key === "freereturns" ||
    key === "count" ||
    key === "shipping" ||
    key === "delivery"
  ) {
    return true;
  }
  return isJsonLdTypeSpecific(spec);
}

async function waitForAttributeFields(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 4000) {
    await expandHiddenAttributes(attributeRoot());
    if (document.querySelectorAll('[data-testid="attribute"]').length > 0) {
      return;
    }
    await delay(150);
  }
}

async function expandHiddenAttributes(root: ParentNode): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const more = [...root.querySelectorAll("button, a, [role='button']")].find((el) => {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return /^(show more|see more|see all|more item specifics)/i.test(text);
    });
    if (!(more instanceof HTMLElement)) {
      return;
    }
    fireClick(more);
    await delay(250);
  }
}

async function fillExistingSpecific(spec: ItemSpecific): Promise<boolean> {
  const fields = findAttributeFields(spec.key);
  if (fields.length === 0) {
    return false;
  }
  for (const field of fields) {
    const filled = await fillAttributeField(field, spec.value);
    if (
      filled &&
      (normalizeYesNo(spec.value) ||
        fieldHasValue(field, spec.value) ||
        specificValues(spec.value).length > 1)
    ) {
      return true;
    }
  }
  return false;
}

async function requestMainYesNo(key: string, value: string): Promise<boolean> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_YES_NO,
      key,
      value,
    })) as FillItemYesNoResponse | undefined;
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

async function requestMainCustom(key: string, value: string): Promise<boolean> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_CUSTOM,
      key,
      value,
    })) as FillItemCustomResponse | undefined;
    if (!response?.ok) {
      console.log("[SellSimilar][specifics] custom failed", key, response?.reason ?? "no response");
    }
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

export async function fillForcedNoSpecifics(): Promise<void> {
  await waitForAttributeFields();
  await expandHiddenAttributes(attributeRoot());
  for (const spec of ALWAYS_NO_SPECIFICS) {
    let ok = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await requestMainYesNo(spec.key, spec.value)) {
        ok = true;
        break;
      }
      await expandHiddenAttributes(attributeRoot());
      await delay(200);
    }
    if (!ok) {
      await fillExistingSpecific(spec);
    }
  }
}

export async function fillEbayListingSpecifics(
  specifics: ItemSpecific[],
): Promise<FillSpecificsResult> {
  await waitForAttributeFields();
  await replaceExistingSpecifics();
  await expandHiddenAttributes(attributeRoot());
  await fillForcedNoSpecifics();
  await delay(400);
  await expandHiddenAttributes(attributeRoot());
  await delay(200);

  const skipped: string[] = [];
  let filled = 0;

  for (const spec of specifics) {
    if (shouldSkipSpecific(spec)) {
      skipped.push(spec.key);
      continue;
    }
    if (isAlwaysNoSpecific(spec.key)) {
      filled += 1;
      continue;
    }
    const toFillValues = specificKeysToFill(spec);
    let filledThis = false;
    for (const key of toFillValues) {
      const toFill = { key, value: spec.value };
      if (await fillExistingSpecific(toFill)) {
        filledThis = true;
        break;
      }

      await expandHiddenAttributes(attributeRoot());
      if (await fillExistingSpecific(toFill)) {
        filledThis = true;
        break;
      }

      const added = await requestMainCustom(toFill.key, toFill.value);
      if (added) {
        filledThis = true;
        await delay(250);
        break;
      }
    }
    if (filledThis) {
      filled += 1;
    } else {
      console.log("[SellSimilar][specifics] skipped", spec.key, spec.value);
      skipped.push(spec.key);
    }
  }

  await fillForcedNoSpecifics();

  console.log("[SellSimilar][specifics] result", { filled, skipped, total: specifics.length });
  return { filled, skipped };
}
