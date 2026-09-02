import type { ListingCategory, StoreCategory } from "./extract-listing-categories.ts";

export type FillCategoriesResult = {
  itemCategory: boolean;
  storeCategories: number;
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

function currentItemCategoryLeaf(): string {
  const button = document.querySelector('button[name="categoryId"]');
  return normalizeText(button?.textContent ?? "");
}

function currentStoreCategoryName(name = "primaryStoreCategoryId"): string {
  const button = document.querySelector(`button[name="${name}"]`);
  return normalizeText(button?.textContent ?? "");
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
  for (const root of pickerRoots()) {
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

  for (const root of pickerRoots()) {
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

async function openStoreCategoryEditor(): Promise<void> {
  clickAny([
    'button[name="primaryStoreCategoryId"]',
    'button[aria-label*="Store category"]',
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
    return false;
  }

  if (leaf && namesMatch(currentItemCategoryLeaf(), leaf)) {
    return true;
  }

  const before = currentItemCategoryLeaf();
  await openItemCategoryEditor();

  const queries = [
    leaf,
    category.path.slice(-2).join(" "),
    category.path.slice(-1)[0] ?? "",
  ]
    .map((query) => normalizeText(query))
    .filter(Boolean);

  for (const query of queries) {
    await searchAndSelect(query, category.id);
    const changed = await waitUntil(
      () => currentItemCategoryLeaf() !== before && Boolean(currentItemCategoryLeaf()),
      1800,
    );
    if (changed || (leaf && namesMatch(currentItemCategoryLeaf(), leaf))) {
      return true;
    }
  }

  return Boolean(leaf && namesMatch(currentItemCategoryLeaf(), leaf));
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

  const before = currentStoreCategoryName(buttonName);
  if (buttonName === "primaryStoreCategoryId") {
    await openStoreCategoryEditor();
  } else {
    clickAny([
      'button[name="secondaryStoreCategoryId"]',
      'button[aria-label*="Second category"]',
    ]);
    await delay(400);
  }

  const selected = clickMatchingChoice(wanted) || (await searchAndSelect(wanted));
  const changed = await waitUntil(
    () => currentStoreCategoryName(buttonName) !== before,
    1800,
  );
  return selected || changed || namesMatch(currentStoreCategoryName(buttonName), wanted);
}

async function fillStoreCategories(storeCategories: StoreCategory[]): Promise<number> {
  const names = storeCategories.map((item) => item.name.trim()).filter(Boolean);
  if (names.length === 0) {
    return 0;
  }

  let filled = 0;
  const primary = names[0];
  if (primary && (await fillOneStoreCategory(primary, "primaryStoreCategoryId"))) {
    filled += 1;
  }
  const secondary = names[1];
  if (secondary && (await fillOneStoreCategory(secondary, "secondaryStoreCategoryId"))) {
    filled += 1;
  }
  return filled;
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
    storeCategories: storeFilled,
  };
}
