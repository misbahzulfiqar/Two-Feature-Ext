import type { ListingCategory } from "@sell-similar/contracts";

export type FillCategoriesResult = {
  itemCategory: boolean;
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

function namesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = compactText(left);
  const b = compactText(right);
  return a === b || a.includes(b) || b.includes(a);
}

function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function fireClick(el: HTMLElement): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
  el.click();
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

  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: value,
      inputType: "insertFromPaste",
    }),
  );
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

function itemCategorySection(): HTMLElement | null {
  const section = document.querySelector(".summary__category");
  return section instanceof HTMLElement ? section : null;
}

function isCategoryPlaceholder(text: string): boolean {
  return /^(select|choose|add|edit|browse)(\s+a)?(\s+item)?(\s+categor(y|ies))?$|^item category$|^category$|^select a category$/i.test(
    text.trim(),
  );
}

function sourceCategoryLeaf(category: ListingCategory): string {
  return normalizeText(category.name || category.path[category.path.length - 1] || "");
}

function leafMatches(haystack: string, leaf: string): boolean {
  const a = compactText(haystack);
  const b = compactText(leaf);
  if (!a || !b) return false;
  return a === b || a.endsWith(b);
}

function currentItemCategoryLeaf(): string {
  const root = itemCategorySection();
  const button = (root ?? document).querySelector(".summary__category button[name='categoryId']");
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

  const secondary = root?.querySelector(".value-secondary");
  const pathText = normalizeText(secondary?.textContent ?? "").replace(/^in\s+/i, "");
  const lastPath = pathText
    .split(/>|›/)
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return lastPath && !isCategoryPlaceholder(lastPath) ? lastPath : "";
}

function currentItemCategoryId(): string {
  const root = itemCategorySection();
  const el = (root ?? document).querySelector(
    ".summary__category button[name='categoryId'], .summary__category input[name='categoryId']",
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
  const leaf = sourceCategoryLeaf(category);
  return leafMatches(currentItemCategoryLeaf(), leaf);
}

function visibleDialogs(): HTMLElement[] {
  const nodes = document.querySelectorAll(
    '.lightbox-dialog, [role="dialog"], .drawer, [class*="category-picker"], [class*="categoryPicker"]',
  );
  const found: HTMLElement[] = [];
  nodes.forEach((node) => {
    if (node instanceof HTMLElement && isShown(node)) {
      found.push(node);
    }
  });
  return found;
}

function isItemCategoryDialog(dialog: HTMLElement): boolean {
  const heading = normalizeText(
    dialog.querySelector("h1, h2, h3, .lightbox-dialog__header, [class*='dialog__header']")
      ?.textContent ?? "",
  );
  if (/store category/i.test(heading) && !/item category/i.test(heading)) {
    return false;
  }
  const text = normalizeText(dialog.textContent ?? "").slice(0, 800).toLowerCase();
  return /item category|select a category|search for a category|browse categor|suggested categor/.test(
    text,
  );
}

function itemCategoryDialogs(): HTMLElement[] {
  const dialogs = visibleDialogs().filter(isItemCategoryDialog);
  return dialogs.length > 0 ? dialogs : visibleDialogs();
}

function isCategorySearchInput(input: HTMLInputElement): boolean {
  if (!isShown(input)) return false;
  if (input.closest(".summary__title, .summary__attributes, .summary__photos, .summary__condition")) {
    return false;
  }
  if (input.closest('[name="primaryStoreCategoryId"], [name="secondaryStoreCategoryId"]')) {
    return false;
  }
  const haystack =
    `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
  if (/store categor/.test(haystack)) {
    return false;
  }
  if (/categor/.test(haystack)) {
    return true;
  }
  const dialog = input.closest(".lightbox-dialog, [role='dialog'], .drawer");
  return dialog instanceof HTMLElement && isShown(dialog) && isItemCategoryDialog(dialog);
}

function findCategorySearchInput(): HTMLInputElement | null {
  const roots: ParentNode[] = [...itemCategoryDialogs()];
  const section = itemCategorySection();
  if (section) {
    roots.push(section);
  }

  for (const root of roots) {
    const inputs = root.querySelectorAll(
      "input.textbox__control, input[type='text'], input[type='search'], input:not([type])",
    );
    for (const input of inputs) {
      if (input instanceof HTMLInputElement && isCategorySearchInput(input)) {
        return input;
      }
    }
  }
  return null;
}

function choiceRoots(): ParentNode[] {
  const roots: ParentNode[] = [...itemCategoryDialogs()];
  document
    .querySelectorAll(
      '[role="listbox"], .listbox__options, .combobox__listbox, .menu:not([hidden]), .fake-menu-button__menu',
    )
    .forEach((node) => {
      if (node instanceof HTMLElement && isShown(node)) {
        roots.push(node);
      }
    });
  const section = itemCategorySection();
  if (section) {
    roots.push(section);
  }
  const input = findCategorySearchInput();
  const combo = input?.closest(".combobox, .listbox-button, [role='combobox'], .summary__category");
  if (combo) {
    roots.push(combo);
  }
  return roots;
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

function nodeCategoryId(node: HTMLElement): string {
  return (
    node.getAttribute("data-category-id") ??
    node.getAttribute("data-categoryid") ??
    node.getAttribute("value") ??
    (node instanceof HTMLInputElement ? node.value : "") ??
    ""
  );
}

function choiceRank(text: string, wanted: string, categoryId: string, idHint: string): number {
  if (categoryId && idHint && idHint === categoryId) {
    return 4;
  }
  const compact = compactText(text);
  const wantedCompact = compactText(wanted);
  if (!wantedCompact || !compact) {
    return 0;
  }
  if (compact === wantedCompact) {
    return 3;
  }
  if (compact.endsWith(wantedCompact)) {
    return 2;
  }
  return 0;
}

function isActionLabel(text: string): boolean {
  return /^(edit|save|cancel|close|search|clear|continue|done|apply|select|use this category|confirm)$/i.test(
    text,
  );
}

function clickMatchingChoice(wanted: string, categoryId = ""): boolean {
  if (!wanted && !categoryId) return false;

  let best: { node: HTMLElement; rank: number } | null = null;
  for (const root of choiceRoots()) {
    for (const node of choiceNodes(root)) {
      if (!isShown(node)) continue;
      if (node.closest(".summary__title, .summary__attributes, .summary__photos")) continue;
      if (node.getAttribute("name") === "primaryStoreCategoryId") continue;
      if (node.getAttribute("name") === "secondaryStoreCategoryId") continue;
      if (node.getAttribute("name") === "categoryId") continue;

      const text = normalizeText(node.textContent ?? "");
      if (!text || text.length > 400 || isActionLabel(text)) continue;

      const rank = choiceRank(text, wanted, categoryId, nodeCategoryId(node));
      if (rank > (best?.rank ?? 0)) {
        best = { node, rank };
        if (rank >= 3) {
          fireClick(best.node);
          return true;
        }
      }
    }
  }

  if (best) {
    fireClick(best.node);
    return true;
  }
  return false;
}

function hasMatchingChoice(wanted: string, categoryId = ""): boolean {
  if (!wanted && !categoryId) return false;
  for (const root of choiceRoots()) {
    for (const node of choiceNodes(root)) {
      if (!isShown(node)) continue;
      const text = normalizeText(node.textContent ?? "");
      if (!text || text.length > 400 || isActionLabel(text)) continue;
      if (choiceRank(text, wanted, categoryId, nodeCategoryId(node)) > 0) {
        return true;
      }
    }
  }
  return false;
}

function clickConfirm(): boolean {
  for (const root of itemCategoryDialogs()) {
    const buttons = root.querySelectorAll("button");
    for (const button of buttons) {
      if (!(button instanceof HTMLElement) || !isShown(button)) continue;
      const text = normalizeText(button.textContent ?? "");
      if (/^(save|apply|done|continue|select|use this category|confirm)$/i.test(text)) {
        fireClick(button);
        return true;
      }
    }
  }
  return false;
}

function categoryPickerOpen(): boolean {
  return itemCategoryDialogs().length > 0 || Boolean(findCategorySearchInput());
}

async function closeCategoryPicker(): Promise<void> {
  if (itemCategoryDialogs().length === 0) {
    return;
  }
  clickConfirm();
  await delay(250);
  if (itemCategoryDialogs().length === 0) {
    return;
  }
  for (const dialog of itemCategoryDialogs()) {
    const closeBtn = dialog.querySelector(
      'button[aria-label="Close"], .lightbox-dialog__close, button.icon-btn[aria-label*="Close" i]',
    );
    if (closeBtn instanceof HTMLElement) {
      fireClick(closeBtn);
      break;
    }
  }
  await waitUntil(() => itemCategoryDialogs().length === 0, 2000);
}

function clickWithin(root: ParentNode, selectors: string[]): boolean {
  for (const selector of selectors) {
    const nodes = root.querySelectorAll(selector);
    for (const el of nodes) {
      if (el instanceof HTMLElement && isShown(el)) {
        fireClick(el);
        return true;
      }
    }
  }
  return false;
}

async function openItemCategoryEditor(): Promise<void> {
  const section = itemCategorySection() ?? document;
  clickWithin(section, [
    ".summary__header-edit-button",
    'button[aria-label="Edit Item category"]',
    'button[aria-label*="Item category" i]',
    'button[name="categoryId"]',
  ]);
  await delay(400);
  await waitUntil(
    () => itemCategoryDialogs().length > 0 || Boolean(findCategorySearchInput()),
    5000,
  );
}

async function searchAndSelect(query: string, categoryId = ""): Promise<boolean> {
  if (clickMatchingChoice(query, categoryId)) {
    await delay(300);
    clickConfirm();
    return true;
  }

  const input = findCategorySearchInput();
  if (input) {
    input.focus();
    input.select();
    setNativeValue(input, query);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await delay(700);
    await waitUntil(() => hasMatchingChoice(query, categoryId), 4500);
  }

  const selected = clickMatchingChoice(query, categoryId);
  await delay(250);
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
      await closeCategoryPicker();
      return true;
    }
  }

  await closeCategoryPicker();
  return Boolean(leaf && namesMatch(currentItemCategoryLeaf(), leaf));
}

export async function fillEbayListingCategories(
  category: ListingCategory,
): Promise<FillCategoriesResult> {
  const itemCategory = await fillItemCategory(category);
  await closeCategoryPicker();
  return { itemCategory };
}
