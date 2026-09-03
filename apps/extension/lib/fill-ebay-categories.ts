import type { ListingCategory, StoreCategory } from "@sell-similar/contracts";

export type FillCategoriesResult = {
  itemCategory: boolean;
  storeCategory: boolean;
  secondStoreCategory: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function compactText(text: string): string {
  return text.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return true;
}

function setNativeValue(input: HTMLInputElement, value: string): void {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const descriptor =
    Object.getOwnPropertyDescriptor(prototype, "value") ??
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  descriptor?.set?.call(input, value);
  if (input.value !== value) {
    input.value = value;
  }

  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await delay(120);
  }
  return predicate();
}

function clickAny(selectors: string[]): boolean {
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const el of nodes) {
      if (el instanceof HTMLElement && isShown(el)) {
        el.click();
        return true;
      }
    }
  }
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.click();
      return true;
    }
  }
  return false;
}

function pickerRoots(): ParentNode[] {
  const roots: ParentNode[] = [];
  const dialogs = document.querySelectorAll(
    '.lightbox-dialog:not([hidden]), [role="dialog"]:not([hidden]), .drawer, [class*="category-picker"], [class*="categoryPicker"]',
  );
  dialogs.forEach((dialog) => roots.push(dialog));
  const section = document.querySelector(".summary__category");
  if (section) {
    roots.push(section);
  }
  roots.push(document);
  return roots;
}

function choicePickerRoots(): ParentNode[] {
  const roots: ParentNode[] = [];
  document
    .querySelectorAll(
      '.lightbox-dialog:not([hidden]), [role="dialog"]:not([hidden]), .drawer, [class*="category-picker"], [class*="categoryPicker"]',
    )
    .forEach((dialog) => roots.push(dialog));
  return roots;
}

function itemCategorySection(): Element | null {
  return document.querySelector(".summary__category");
}

function isCategoryPlaceholder(text: string): boolean {
  return /^(select|choose|add|edit|browse)(\s+a)?(\s+item)?(\s+categor(y|ies))?$|^item category$|^category$/i.test(
    text.trim(),
  );
}

function currentItemCategoryLeaf(): string {
  const root = itemCategorySection();
  const button = (root ?? document).querySelector('button[name="categoryId"]');
  if (button instanceof HTMLElement) {
    const text = normalizeText(button.textContent ?? "");
    if (text && !isCategoryPlaceholder(text)) {
      return text;
    }
    const aria = normalizeText(button.getAttribute("aria-label") ?? "")
      .replace(/\s+item category first category$/i, "")
      .replace(/\s+item category.*$/i, "")
      .trim();
    if (aria && !isCategoryPlaceholder(aria)) {
      return aria;
    }
  }

  const pathText = currentItemCategoryPathText();
  const lastPath = pathText.split(/>|›/).map((part) => part.trim()).filter(Boolean).pop();
  return lastPath && !isCategoryPlaceholder(lastPath) ? lastPath : "";
}

function currentItemCategoryPathText(): string {
  const root = itemCategorySection();
  const secondary = root?.querySelector(".value-secondary");
  return normalizeText(secondary?.textContent ?? "").replace(/^in\s+/i, "");
}

function currentItemCategoryId(): string {
  const root = itemCategorySection();
  const el = (root ?? document).querySelector(
    'button[name="categoryId"], input[name="categoryId"], input[name="primaryCategoryId"]',
  );
  if (!(el instanceof HTMLElement)) {
    return "";
  }
  if (el instanceof HTMLInputElement) {
    return normalizeText(el.value);
  }
  return normalizeText(el.getAttribute("value") ?? "");
}

function itemCategoryMatches(category: ListingCategory): boolean {
  if (category.id && currentItemCategoryId() && category.id === currentItemCategoryId()) {
    return true;
  }
  const current = [currentItemCategoryLeaf(), currentItemCategoryPathText()]
    .filter(Boolean)
    .join(" ");
  if (!current) {
    return false;
  }
  const candidates = [category.name, ...category.path].filter(Boolean);
  return candidates.some((candidate) => namesMatch(current, candidate));
}

function hasItemCategorySelected(): boolean {
  const current = currentItemCategoryLeaf();
  return Boolean(current) && !isCategoryPlaceholder(current);
}

function categoryPickerOpen(): boolean {
  return choicePickerRoots().length > 0;
}

async function closeCategoryPicker(): Promise<void> {
  if (!categoryPickerOpen()) {
    return;
  }
  clickAny([
    '.lightbox-dialog:not([hidden]) button[aria-label="Close"]',
    '[role="dialog"]:not([hidden]) button[aria-label="Close"]',
    '.lightbox-dialog:not([hidden]) .lightbox-dialog__close',
  ]);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitUntil(() => !categoryPickerOpen(), 1600);
}

function currentStoreCategoryName(
  buttonName: "primaryStoreCategoryId" | "secondaryStoreCategoryId" = "primaryStoreCategoryId",
): string {
  const selector =
    buttonName === "secondaryStoreCategoryId"
      ? 'button[name="secondaryStoreCategoryId"], button[aria-label*="Store category Second" i], button[aria-label*="second store category" i]'
      : 'button[name="primaryStoreCategoryId"], button[aria-label*="Store category First" i]';
  const button = document.querySelector(selector);
  return normalizeText(button?.textContent ?? "");
}

function isStoreCategoryPlaceholder(text: string): boolean {
  return (
    isCategoryPlaceholder(text) ||
    /^(add( a)?( second)?( store)? category|second category|store category)$/i.test(text.trim())
  );
}

function storeCategoryIsSet(
  buttonName: "primaryStoreCategoryId" | "secondaryStoreCategoryId",
): boolean {
  const text = currentStoreCategoryName(buttonName);
  return Boolean(text) && !isStoreCategoryPlaceholder(text);
}

function namesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = compactText(left);
  const b = compactText(right);
  return a === b || a.includes(b) || b.includes(a);
}

function findSearchInput(): HTMLInputElement | null {
  for (const root of pickerRoots()) {
    const inputs = root.querySelectorAll(
      "input.textbox__control, input[type='text'], input[type='search'], input:not([type])",
    );
    for (const input of inputs) {
      if (!(input instanceof HTMLInputElement) || !isShown(input)) continue;
      const haystack =
        `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
      if (/categor|search|keyword|find/.test(haystack)) {
        return input;
      }
    }
  }
  for (const root of pickerRoots()) {
    const inputs = root.querySelectorAll("input.textbox__control, input[type='text']");
    for (const input of inputs) {
      if (input instanceof HTMLInputElement && isShown(input) && !input.closest(".summary__title")) {
        return input;
      }
    }
  }
  return null;
}

function choiceNodes(root: ParentNode): HTMLElement[] {
  const nodes = root.querySelectorAll(
    '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="treeitem"], .listbox__option, .menu__item, .fake-menu-button__item, input[type="radio"], label, li, button, a',
  );
  const found: HTMLElement[] = [];
  nodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      found.push(node);
    }
  });
  return found;
}

function hasMatchingChoice(wanted: string, categoryId = ""): boolean {
  if (!wanted && !categoryId) return false;
  const wantedCompact = compactText(wanted);
  const roots = choicePickerRoots();
  if (roots.length === 0) return false;
  for (const root of roots) {
    for (const node of choiceNodes(root)) {
      if (!isShown(node)) continue;
      const idHint =
        node.getAttribute("data-category-id") ??
        node.getAttribute("data-categoryid") ??
        (node instanceof HTMLInputElement ? node.value : "") ??
        "";
      if (categoryId && idHint === categoryId) {
        return true;
      }
      const text = normalizeText(node.textContent ?? "");
      if (!text || text.length > 400) continue;
      const compact = compactText(text);
      if (
        wantedCompact &&
        (compact === wantedCompact ||
          compact.includes(wantedCompact) ||
          text.toLowerCase().includes(wanted.toLowerCase()))
      ) {
        return true;
      }
    }
  }
  return false;
}

function clickMatchingChoice(wanted: string, categoryId = ""): boolean {
  if (!wanted && !categoryId) return false;
  const wantedCompact = compactText(wanted);
  let fallback: HTMLElement | null = null;
  const roots = choicePickerRoots();
  if (roots.length === 0) return false;

  for (const root of roots) {
    for (const node of choiceNodes(root)) {
      if (!isShown(node)) continue;
      const idHint =
        node.getAttribute("data-category-id") ??
        node.getAttribute("data-categoryid") ??
        (node instanceof HTMLInputElement ? node.value : "") ??
        "";
      if (categoryId && idHint === categoryId) {
        node.click();
        return true;
      }

      const text = normalizeText(node.textContent ?? "");
      if (!text || text.length > 400) continue;
      if (/^(edit|save|cancel|close|search|clear)$/i.test(text)) continue;

      const compact = compactText(text);
      if (wantedCompact && compact === wantedCompact) {
        node.click();
        return true;
      }
      if (
        wantedCompact &&
        !fallback &&
        (compact.includes(wantedCompact) || text.toLowerCase().includes(wanted.toLowerCase()))
      ) {
        fallback = node;
      }
    }
  }

  if (fallback) {
    fallback.click();
    return true;
  }
  return false;
}

function clickConfirm(): boolean {
  for (const root of pickerRoots()) {
    const buttons = root.querySelectorAll("button");
    for (const button of buttons) {
      if (!(button instanceof HTMLElement) || !isShown(button)) continue;
      const text = normalizeText(button.textContent ?? "");
      if (/^(save|apply|done|continue|select|use this category|confirm)$/i.test(text)) {
        button.click();
        return true;
      }
    }
  }
  return false;
}

async function openItemCategoryEditor(): Promise<void> {
  clickAny([
    'button[name="categoryId"]',
    'button[aria-label*="Item category"]',
    'button[aria-label="Edit Item category"]',
    ".summary__category .summary__header-edit-button",
  ]);
  await delay(300);
  await waitUntil(() => Boolean(findSearchInput()) || clickMatchingChoiceReady(), 2500);
}

function clickMatchingChoiceReady(): boolean {
  for (const root of pickerRoots()) {
    if (choiceNodes(root).some((node) => isShown(node) && (node.getAttribute("role") || node instanceof HTMLInputElement))) {
      return true;
    }
  }
  return false;
}

function clickShownByText(pattern: RegExp): boolean {
  const nodes = document.querySelectorAll("button, a, [role='button']");
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isShown(node)) continue;
    if (pattern.test(normalizeText(node.textContent ?? ""))) {
      node.click();
      return true;
    }
  }
  return false;
}

async function openStoreCategoryEditor(): Promise<void> {
  clickAny([
    'button[name="primaryStoreCategoryId"]',
    'button[aria-label*="Store category First" i]',
  ]);
  await delay(300);
  await waitUntil(() => {
    return pickerRoots().some((root) =>
      choiceNodes(root).some((node) => {
        const role = node.getAttribute("role") ?? "";
        return isShown(node) && /menuitem|option/.test(role);
      }),
    ) || Boolean(findSearchInput());
  }, 2500);
}

async function openSecondStoreCategoryEditor(): Promise<void> {
  const opened = clickAny([
    'button[name="secondaryStoreCategoryId"]',
    'button[aria-label*="Store category Second" i]',
    'button[aria-label*="second store category" i]',
  ]);
  if (!opened) {
    clickShownByText(
      /^(add( a)? second (store )?category|second (store )?category)$/i,
    );
  }
  await delay(400);
  await waitUntil(
    () =>
      Boolean(document.querySelector('button[name="secondaryStoreCategoryId"]')) ||
      Boolean(findSearchInput()) ||
      choicePickerRoots().length > 0,
    2500,
  );
}

async function searchAndSelect(query: string, categoryId = ""): Promise<boolean> {
  const input = findSearchInput();
  if (input) {
    input.focus();
    setNativeValue(input, query);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await delay(600);
    await waitUntil(() => hasMatchingChoice(query, categoryId), 1800);
  }

  const selected = clickMatchingChoice(query, categoryId);
  await delay(200);
  clickConfirm();
  await delay(500);
  return selected;
}

async function fillItemCategory(category: ListingCategory): Promise<boolean> {
  const leaf = category.name || category.path[category.path.length - 1] || "";
  if (!leaf && !category.id) {
    return hasItemCategorySelected();
  }

  if (itemCategoryMatches(category) || hasItemCategorySelected()) {
    return true;
  }

  const before = currentItemCategoryLeaf();
  await openItemCategoryEditor();

  const queries = [...new Set([leaf, category.path[category.path.length - 1] ?? ""])]
    .map((query) => normalizeText(query))
    .filter(Boolean);

  for (const query of queries) {
    const selected = await searchAndSelect(query, category.id);
    const changed = await waitUntil(() => {
      const now = currentItemCategoryLeaf();
      return Boolean(now) && now !== before && !isCategoryPlaceholder(now);
    }, 2500);
    if (selected || changed || itemCategoryMatches(category)) {
      await closeCategoryPicker();
      return true;
    }
  }

  await closeCategoryPicker();
  await waitUntil(() => hasItemCategorySelected() || itemCategoryMatches(category), 4000);
  return itemCategoryMatches(category) || hasItemCategorySelected();
}

async function fillOneStoreCategory(
  wanted: string,
  buttonName: "primaryStoreCategoryId" | "secondaryStoreCategoryId",
): Promise<boolean> {
  if (!wanted) {
    return false;
  }
  if (namesMatch(currentStoreCategoryName(buttonName), wanted)) {
    return true;
  }

  if (buttonName === "primaryStoreCategoryId") {
    await openStoreCategoryEditor();
  } else {
    await openSecondStoreCategoryEditor();
  }

  await searchAndSelect(wanted);
  await waitUntil(
    () => namesMatch(currentStoreCategoryName(buttonName), wanted),
    2200,
  );
  await closeCategoryPicker();
  return (
    namesMatch(currentStoreCategoryName(buttonName), wanted) ||
    storeCategoryIsSet(buttonName)
  );
}

async function fillStoreCategories(
  storeCategories: StoreCategory[],
): Promise<{ storeCategory: boolean; secondStoreCategory: boolean }> {
  const names: string[] = [];
  for (const item of storeCategories) {
    const name = item.name.trim();
    if (!name) continue;
    if (names.some((existing) => compactText(existing) === compactText(name))) continue;
    names.push(name);
  }

  const primary = names[0];
  if (primary) {
    await fillOneStoreCategory(primary, "primaryStoreCategoryId");
  }

  const secondary = names[1];
  if (secondary) {
    await fillOneStoreCategory(secondary, "secondaryStoreCategoryId");
  }

  return {
    storeCategory: storeCategoryIsSet("primaryStoreCategoryId"),
    secondStoreCategory: storeCategoryIsSet("secondaryStoreCategoryId"),
  };
}

export async function fillEbayListingCategories(
  category: ListingCategory,
  storeCategories: StoreCategory[],
): Promise<FillCategoriesResult> {
  const itemCategory = await fillItemCategory(category);
  await delay(250);
  const storeFilled = await fillStoreCategories(storeCategories);
  await delay(250);
  return {
    itemCategory,
    storeCategory: storeFilled.storeCategory,
    secondStoreCategory: storeFilled.secondStoreCategory,
  };
}
