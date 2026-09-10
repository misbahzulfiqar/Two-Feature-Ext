export type FillItemCategoryMainArg = {
  id: string;
  name: string;
  path: string[];
};

export type FillItemCategoryMainResult = {
  ok: boolean;
  itemCategory: boolean;
  reason: string;
};

/**
 * Runs in the listing page MAIN world so eBay React sees the same DOM
 * events as a real click/type. Do not close over module scope — Chrome
 * serializes this function into the page.
 */
export async function fillItemCategoryInPage(
  category: FillItemCategoryMainArg,
): Promise<FillItemCategoryMainResult> {
  const log = (step: string, detail?: unknown): void => {
    if (detail === undefined) {
      console.log(`[SellSimilar][item-category] ${step}`);
      return;
    }
    console.log(`[SellSimilar][item-category] ${step}`, detail);
  };

  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const compact = (text: string): string =>
    text.replace(/&/g, "and").replace(/[^a-z0-9]/gi, "").toLowerCase();

  const normalize = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const segmentMatch = (left: string, right: string): boolean => {
    if (!left || !right) return false;
    const a = compact(left);
    const b = compact(right);
    return a === b || a.endsWith(b) || b.endsWith(a);
  };

  const isShown = (el: HTMLElement): boolean => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const fireClick = (el: HTMLElement, reason: string): void => {
    log("click", {
      reason,
      tag: el.tagName,
      name: el.getAttribute("name"),
      aria: el.getAttribute("aria-label"),
      text: normalize(el.textContent ?? "").slice(0, 180),
    });
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.click();
  };

  const waitUntil = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return true;
      await delay(150);
    }
    return predicate();
  };

  const itemSection = (): HTMLElement | null => {
    const byInflow = document.querySelector('[inflow*="itemCategory"]');
    if (byInflow instanceof HTMLElement) return byInflow;
    const byClass = document.querySelector(".smry.summary__category, .summary__category");
    if (byClass instanceof HTMLElement) return byClass;
    for (const heading of document.querySelectorAll("h2.textual-display, h2, h3")) {
      if (normalize(heading.textContent ?? "") !== "item category") continue;
      const section = heading.closest(".smry, .summary__category, section");
      if (section instanceof HTMLElement) return section;
    }
    return null;
  };

  const firstCategoryValueButton = (): HTMLButtonElement | null => {
    const section = itemSection();
    if (!section) return null;
    for (const column of section.querySelectorAll(".summary__section-column")) {
      if (!(column instanceof HTMLElement)) continue;
      if (/store category/i.test(column.textContent ?? "") && !column.querySelector('button[name="categoryId"]')) {
        continue;
      }
      const button = column.querySelector('button[name="categoryId"]');
      if (button instanceof HTMLButtonElement && isShown(button)) return button;
    }
    const button = section.querySelector('button[name="categoryId"]');
    return button instanceof HTMLButtonElement && isShown(button) ? button : null;
  };

  const editItemCategoryButton = (): HTMLButtonElement | null => {
    const section = itemSection();
    const exact = section?.querySelector('button[aria-label="Edit Item category"]');
    if (exact instanceof HTMLButtonElement && isShown(exact)) return exact;
    const byClass = section?.querySelector("button.summary__header-edit-button");
    if (byClass instanceof HTMLButtonElement && isShown(byClass)) return byClass;
    return null;
  };

  const itemCopy = (): { leaf: string; path: string[] } => {
    const button = firstCategoryValueButton();
    const leaf = normalize(button?.textContent ?? "");
    const secondary = normalize(
      (button?.parentElement?.querySelector(".value-secondary") ??
        itemSection()?.querySelector(".summary__section-column .value-secondary"))?.textContent ??
        "",
    ).replace(/^in\s+/i, "");
    const parents = secondary
      .split(/>|›/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!leaf && !parents.length) return { leaf: "", path: [] };
    const lastParent = parents[parents.length - 1] ?? "";
    const path =
      lastParent && leaf && segmentMatch(lastParent, leaf)
        ? parents
        : [...parents, leaf].filter(Boolean);
    return { leaf, path };
  };

  const listingPath = (): string[] => itemCopy().path;

  const pathsAlign = (sourcePath: string[], targetPath: string[]): boolean => {
    const source = sourcePath.map(compact).filter(Boolean);
    const target = targetPath.map(compact).filter(Boolean);
    if (!source.length || !target.length) return false;
    const sourceLeaf = source[source.length - 1] ?? "";
    const targetLeaf = target[target.length - 1] ?? "";
    if (!segmentMatch(sourceLeaf, targetLeaf)) return false;
    const needed = source.slice(-Math.min(3, source.length));
    return needed.every((seg) => target.some((part) => segmentMatch(seg, part)));
  };

  const haystackHasPath = (haystack: string, sourcePath: string[]): boolean => {
    const hay = compact(haystack);
    if (!hay) return false;
    const source = sourcePath.map(compact).filter(Boolean);
    if (!source.length) return false;
    const leaf = source[source.length - 1] ?? "";
    if (!hay.includes(leaf) && !segmentMatch(hay, leaf)) return false;
    const needed = source.slice(-Math.min(3, source.length));
    return needed.every((seg) => hay.includes(seg));
  };

  const visibleDialogs = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    document
      .querySelectorAll('.lightbox-dialog, [role="dialog"], .drawer, .lightbox-dialog__window')
      .forEach((node) => {
        if (node instanceof HTMLElement && isShown(node) && !node.hasAttribute("hidden")) {
          found.push(node);
        }
      });
    return found;
  };

  const isCategoryDialogEl = (el: HTMLElement): boolean => {
    const header = normalize(
      el.querySelector("h1, h2, .lightbox-dialog__header")?.textContent ?? "",
    );
    const body = normalize(el.innerText ?? "").slice(0, 800).toLowerCase();
    return (
      /item category|select a category|search for a category/i.test(header) ||
      body.includes("first category") ||
      body.includes("search for a category")
    );
  };

  const categoryDialog = (): HTMLElement | null => {
    for (const dialog of visibleDialogs()) {
      if (isCategoryDialogEl(dialog)) {
        return dialog;
      }
    }
    return null;
  };

  const closeForeignDialogs = async (): Promise<void> => {
    for (const dialog of visibleDialogs()) {
      if (isCategoryDialogEl(dialog)) continue;
      const closeBtn = dialog.querySelector(
        'button[aria-label*="Close" i], button[aria-label*="close" i]',
      );
      if (closeBtn instanceof HTMLElement) {
        fireClick(closeBtn, "close non-category dialog");
        await delay(300);
      }
    }
  };

  const isSettingsSheet = (): boolean => {
    const dialog = categoryDialog();
    if (!dialog) return false;
    const text = normalize(dialog.textContent ?? "").slice(0, 900).toLowerCase();
    return text.includes("first category") && /\bdone\b/i.test(text);
  };

  const firstCategoryPath = (): string => {
    const dialog = categoryDialog();
    if (!dialog) return "";
    const raw = dialog.innerText || "";
    const storeAt = raw.search(/\nStore category/i);
    const itemPart = storeAt >= 0 ? raw.slice(0, storeAt) : raw;
    const match = itemPart.match(/First category\s+([\s\S]*?)\s+Second category/i);
    return normalize(match?.[1] ?? "");
  };

  const snapshot = (): Record<string, unknown> => {
    const dialog = categoryDialog();
    const buttons = [...(dialog?.querySelectorAll("button") ?? [])]
      .filter((btn): btn is HTMLButtonElement => btn instanceof HTMLButtonElement && isShown(btn))
      .slice(0, 16)
      .map((btn) => normalize(btn.textContent ?? "").slice(0, 120));
    return {
      header: normalize(
        dialog?.querySelector("h1, h2, .lightbox-dialog__header")?.textContent ?? "",
      ),
      isSettingsSheet: isSettingsSheet(),
      hasSearch: Boolean(searchInput()),
      firstCategoryPath: firstCategoryPath(),
      listingPath: listingPath(),
      buttons,
      snippet: normalize(dialog?.innerText ?? "").slice(0, 400),
    };
  };

  const pickerRoots = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    const add = (node: Element | null): void => {
      if (node instanceof HTMLElement && isShown(node) && !found.includes(node)) {
        found.push(node);
      }
    };
    visibleDialogs().forEach(add);
    document
      .querySelectorAll(
        '[role="listbox"], .listbox, [class*="listbox"], .combobox__listbox, .menu__items',
      )
      .forEach(add);
    return found;
  };

  const searchInput = (): HTMLInputElement | null => {
    const roots: ParentNode[] = pickerRoots();
    if (!roots.length) roots.push(document);
    for (const root of roots) {
      const inputs = root.querySelectorAll(
        "input.textbox__control, input[type='search'], input[type='text']",
      );
      for (const input of inputs) {
        if (!(input instanceof HTMLInputElement) || !isShown(input)) continue;
        const hay =
          `${input.name} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
        if (/store/.test(hay) || /search or enter your own/i.test(hay)) continue;
        if (/search|category/i.test(hay) || root !== document) return input;
      }
    }
    return null;
  };

  const isChrome = (text: string): boolean =>
    /^(done|cancel|close|search|clear|edit|continue|select|apply|first category|second category|item category|store category|back)$/i.test(
      text,
    );

  const nodeCategoryId = (node: HTMLElement): string => {
    const href = node.getAttribute("href") ?? "";
    const raw = [
      node.getAttribute("data-category-id"),
      node.getAttribute("value"),
      node instanceof HTMLInputElement ? node.value : "",
      node.getAttribute("aria-label"),
      href,
    ]
      .filter(Boolean)
      .join(" ");
    const fromHref = href.match(/\/b\/[^/?#]+\/(\d+)/i)?.[1];
    if (fromHref) return fromHref;
    const digits = raw.match(/\b(\d{3,})\b/);
    return digits?.[1] ?? "";
  };

  const findCategoryResult = (
    sourcePath: string[],
    categoryId: string,
  ): HTMLElement | null => {
    const leaf = sourcePath[sourcePath.length - 1] ?? "";
    const shortLeaf = compact(leaf).length < 10;
    let best: { node: HTMLElement; rank: number; size: number } | null = null;
    const roots: ParentNode[] = pickerRoots();
    if (!roots.length) roots.push(document);
    for (const root of roots) {
      const nodes = root.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="radio"], input[type="radio"], label, a, button, li',
      );
      for (const node of nodes) {
        if (!(node instanceof HTMLElement) || !isShown(node)) continue;
        const text = normalize(node.textContent ?? "");
        if (!text || text.length > 400 || isChrome(text)) continue;
        if (/nellis/i.test(text) || /store category/i.test(text)) continue;
        const idHint = nodeCategoryId(node);
        let rank = 0;
        if (categoryId && (idHint === categoryId || text.includes(categoryId))) rank = 5;
        else if (haystackHasPath(text, sourcePath)) rank = 4;
        else if (segmentMatch(text.split(/>|›/).pop() ?? "", leaf) && sourcePath.length > 1) {
          const parent = sourcePath[sourcePath.length - 2] ?? "";
          rank = compact(text).includes(compact(parent)) ? 3 : shortLeaf ? 0 : 2;
        }
        if (rank === 0) continue;
        if (!best || rank > best.rank || (rank === best.rank && text.length < best.size)) {
          best = { node, rank, size: text.length };
        }
      }
    }
    return best?.node ?? null;
  };

  const clickLabeled = (pattern: RegExp, reason: string): boolean => {
    for (const dialog of visibleDialogs()) {
      for (const node of dialog.querySelectorAll("button, a, [role='button']")) {
        if (!(node instanceof HTMLElement) || !isShown(node)) continue;
        if (pattern.test(normalize(node.textContent ?? ""))) {
          fireClick(node, reason);
          return true;
        }
      }
    }
    return false;
  };

  const dismiss = (): void => {
    for (const dialog of visibleDialogs()) {
      for (const node of dialog.querySelectorAll("button, a, [role='button']")) {
        if (!(node instanceof HTMLElement) || !isShown(node)) continue;
        const text = normalize(node.textContent ?? "");
        const aria = node.getAttribute("aria-label") ?? "";
        if (/^(cancel|close)$/i.test(text) || /close/i.test(aria)) {
          fireClick(node, "dismiss");
          return;
        }
      }
    }
  };

  const clickFirstCategory = (): boolean => {
    const dialog = categoryDialog();
    if (!dialog) return false;
    const storeAt = (dialog.innerText || "").search(/\nStore category/i);
    const nodes = dialog.querySelectorAll(
      "button, a, [role='button'], [role='link'], [tabindex='0'], .list__item, .fake-list__item",
    );
    let pathRow: HTMLElement | null = null;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      const text = normalize(node.textContent ?? "");
      if (/^done$/i.test(text) || /second category/i.test(text) || /nellis/i.test(text)) {
        continue;
      }
      if (storeAt >= 0) {
        const offset = (dialog.innerText || "").indexOf(node.textContent ?? "");
        if (offset > storeAt) continue;
      }
      if (/>|›/.test(text) && !/store category/i.test(text)) {
        pathRow = node;
      }
      if (/first category/i.test(text)) {
        fireClick(node, "settings First category row");
        return true;
      }
    }
    if (pathRow) {
      fireClick(pathRow, "settings First category path");
      return true;
    }
    log("First category row not found", snapshot());
    return false;
  };

  const setNativeValue = (input: HTMLInputElement, value: string): void => {
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
  };

  const typeSearch = async (input: HTMLInputElement, text: string): Promise<void> => {
    input.focus();
    input.click();
    input.select();
    setNativeValue(input, "");
    await delay(80);
    setNativeValue(input, text);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  };

  const fail = (reason: string): FillItemCategoryMainResult => {
    log(`FAIL: ${reason}`, snapshot());
    dismiss();
    return { ok: false, itemCategory: false, reason };
  };

  try {
    const sourcePath = (category.path.length ? category.path : [category.name])
      .map(normalize)
      .filter(Boolean);
    const leaf = normalize(category.name || sourcePath[sourcePath.length - 1] || "");
    const pathText = sourcePath.join(" > ");
    log("MAIN-world start", {
      id: category.id,
      name: leaf,
      path: sourcePath,
      pathText,
      listingPath: listingPath(),
      hasCategoryIdButton: Boolean(firstCategoryValueButton()),
      hasEditButton: Boolean(editItemCategoryButton()),
      sectionClass: itemSection()?.className,
    });

    if (!leaf && !category.id) {
      return { ok: false, itemCategory: false, reason: "Source has no category name or id" };
    }
    if (pathsAlign(sourcePath, listingPath())) {
      log("skip: listing breadcrumb already matches source path");
      return { ok: true, itemCategory: true, reason: "already set" };
    }

    const before = listingPath().join(" > ");
    await closeForeignDialogs();

    const pickerReady = (): boolean =>
      Boolean(searchInput()) || Boolean(categoryDialog()) || Boolean(findCategoryResult(sourcePath, category.id));

    if (!pickerReady()) {
      const valueBtn = firstCategoryValueButton();
      if (valueBtn) {
        fireClick(valueBtn, "button[name=categoryId] First category");
        await waitUntil(pickerReady, 5000);
        log("after categoryId click", snapshot());
      }
    }
    if (isSettingsSheet() || (categoryDialog() && !searchInput())) {
      clickFirstCategory();
      await waitUntil(() => Boolean(searchInput()) || Boolean(findCategoryResult(sourcePath, category.id)), 5000);
      log("after First category click", snapshot());
    }
    if (!pickerReady()) {
      const edit = editItemCategoryButton();
      if (!edit) {
        return fail("Could not find Item category Edit or button[name=categoryId]");
      }
      fireClick(edit, "Edit Item category");
      await waitUntil(() => Boolean(categoryDialog()), 8000);
      log("dialog after Edit click", snapshot());
      if (isSettingsSheet() || (categoryDialog() && !searchInput())) {
        clickFirstCategory();
        await waitUntil(() => Boolean(searchInput()), 5000);
        log("after First category click", snapshot());
      }
    }
    if (!pickerReady()) {
      return fail("Item category picker did not open");
    }

    const queries = [
      ...new Set([leaf, sourcePath.slice(-2).join(" "), category.id, pathText]),
    ]
      .map((query) => normalize(query))
      .filter(Boolean);

    let picked = false;
    for (const query of queries) {
      const input = searchInput();
      if (input) {
        log("typing search", { query, placeholder: input.placeholder });
        await typeSearch(input, query);
      } else {
        log("no search input; using visible results", snapshot());
      }
      const found = await waitUntil(
        () => Boolean(findCategoryResult(sourcePath, category.id)),
        4000,
      );
      const node = findCategoryResult(sourcePath, category.id);
      log("search result", {
        query,
        found,
        resultText: node ? normalize(node.textContent ?? "").slice(0, 180) : "",
      });
      if (!found || !node) continue;
      const radio =
        node instanceof HTMLInputElement ? node : node.querySelector("input[type='radio']");
      fireClick(radio instanceof HTMLElement ? radio : node, "search result");
      await delay(400);
      clickLabeled(/^(continue|select|apply)$/i, "continue");
      picked = true;
      break;
    }

    if (!picked) {
      return fail(`No matching category for id=${category.id || "none"} path="${pathText}"`);
    }

    const ready = await waitUntil(() => {
      return (
        haystackHasPath(firstCategoryPath(), sourcePath) ||
        pathsAlign(sourcePath, listingPath())
      );
    }, 6000);
    log("ready to save?", {
      ready,
      firstCategoryPath: firstCategoryPath(),
      listingPath: listingPath(),
      wanted: pathText,
    });
    if (!ready) {
      return fail("Category verification failed before Done: First category path does not match source");
    }

    clickLabeled(/^done$/i, "Done");
    await delay(400);
    if (isSettingsSheet() && haystackHasPath(firstCategoryPath(), sourcePath)) {
      clickLabeled(/^done$/i, "Done again");
    }

    const applied = await waitUntil(() => {
      const now = listingPath();
      return now.join(" > ") !== before && pathsAlign(sourcePath, now);
    }, 8000);
    log(applied ? "SUCCESS listing breadcrumb matches source" : "FAIL listing breadcrumb mismatch", {
      before,
      now: listingPath(),
      wanted: pathText,
    });
    if (!applied) {
      return fail("Category verification failed: target breadcrumb does not match source path");
    }
    return { ok: true, itemCategory: true, reason: "updated" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log("MAIN-world error", reason);
    return { ok: false, itemCategory: false, reason };
  }
}
