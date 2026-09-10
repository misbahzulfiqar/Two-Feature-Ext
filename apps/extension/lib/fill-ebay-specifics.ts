import type { ItemSpecific } from "@sell-similar/contracts";

export type FillSpecificsResult = {
  filled: number;
  skipped: string[];
};

function compactKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
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

function splitForInputLimit(value: string, maxLength: number): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.length <= maxLength) {
    return [trimmed];
  }

  const parts = trimmed
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (part.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < part.length; index += maxLength) {
        chunks.push(part.slice(index, index + maxLength));
      }
      continue;
    }

    const next = current ? `${current}, ${part}` : part;
    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) {
        chunks.push(current);
      }
      current = part;
    }
  }

  if (current) {
    chunks.push(current);
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

function clickYesNo(field: Element, value: string): boolean {
  const wanted = normalizeYesNo(value);
  if (!wanted) {
    return false;
  }

  const root = attributeValueRoot(field);

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
  const chunks = splitForInputLimit(value, limit);
  if (chunks.length === 0) {
    return false;
  }

  let any = false;
  for (const chunk of chunks) {
    searchInput.focus();
    setNativeValue(searchInput, chunk);
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
    searchInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
    await delay(180);
    if (clickMatchingOption(field, chunk)) {
      any = true;
    } else {
      any = true;
    }
    await delay(120);
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

function fieldHasValue(field: Element, value: string): boolean {
  const wanted = canonicalKey(value);
  if (!wanted) return false;
  const selected = selectedDropdownText(field);
  if (selected && (canonicalKey(selected) === wanted || canonicalKey(selected).includes(wanted))) {
    return true;
  }
  for (const input of field.querySelectorAll("input, textarea")) {
    if (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      canonicalKey(input.value) === wanted
    ) {
      return true;
    }
  }
  const chips = canonicalKey(field.textContent ?? "");
  return Boolean(wanted.length >= 3 && chips.includes(wanted));
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
  await expandHiddenAttributes(root);
  await delay(120);
  await removeOptionalAttributes(root);
  await clearRemainingAttributeFields(root);
  await delay(120);
}

export async function clearEbayListingSpecifics(): Promise<void> {
  await replaceExistingSpecifics();
}

function shouldSkipSpecific(spec: ItemSpecific): boolean {
  const key = compactKey(spec.key);
  if (
    key === "condition" ||
    key === "sellernotes" ||
    key === "category" ||
    key === "itemcategory" ||
    key === "itemspecifics"
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

  for (const field of fields) {
    if (await fillAttributeField(field, spec.value)) {
      return true;
    }
  }
  return false;
}

async function fillExistingSpecific(spec: ItemSpecific): Promise<boolean> {
  const fields = findAttributeFields(spec.key);
  if (fields.length === 0) {
    return false;
  }
  for (const field of fields) {
    if ((await fillAttributeField(field, spec.value)) && fieldHasValue(field, spec.value)) {
      return true;
    }
  }
  return false;
}

export async function fillEbayListingSpecifics(
  specifics: ItemSpecific[],
): Promise<FillSpecificsResult> {
  await waitForAttributeFields();
  await replaceExistingSpecifics();
  await expandHiddenAttributes(attributeRoot());
  await delay(200);

  const skipped: string[] = [];
  let filled = 0;

  for (const spec of specifics) {
    if (shouldSkipSpecific(spec)) {
      skipped.push(spec.key);
      continue;
    }
    if (await fillExistingSpecific(spec)) {
      filled += 1;
      continue;
    }

    await expandHiddenAttributes(attributeRoot());
    if (await fillExistingSpecific(spec)) {
      filled += 1;
      continue;
    }

    const added = await addAndFillMissingSpecific(spec);
    if (added) {
      filled += 1;
    } else {
      console.log("[SellSimilar][specifics] skipped", spec.key, spec.value);
      skipped.push(spec.key);
    }
  }

  console.log("[SellSimilar][specifics] result", { filled, skipped, total: specifics.length });
  return { filled, skipped };
}
