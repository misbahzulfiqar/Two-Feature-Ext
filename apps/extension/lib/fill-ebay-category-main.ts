export type ItemCategoryFillInput = {
  id: string;
  name: string;
  path: string[];
};

export type ItemCategoryFillResult = {
  ok: boolean;
  itemCategory: boolean;
  reason: string;
};

/**
 * Selects the target listing's item category from the page's own JavaScript world.
 * Do not close over module scope — Chrome serializes this function into the page.
 * Seller Store categories are left alone.
 */
export async function fillItemCategoryInPage(
  category: ItemCategoryFillInput,
): Promise<ItemCategoryFillResult> {
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const log = (message: string, detail?: unknown): void => {
    if (detail === undefined) {
      console.log("[SellSimilar][item-category]", message);
      return;
    }
    console.log("[SellSimilar][item-category]", message, detail);
  };

  const clean = (value: string): string => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const normalize = (value: string): string => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

  const collect = (root: ParentNode): Element[] => {
    const found: Element[] = [];
    const visit = (node: ParentNode): void => {
      for (const child of node.querySelectorAll("*")) {
        found.push(child);
        if (child.shadowRoot) {
          visit(child.shadowRoot);
        }
      }
    };
    visit(root);
    return found;
  };

  const visible = (element: Element): boolean => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const ownText = (element: Element): string => {
    const chunks: string[] = [];
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        chunks.push(node.textContent ?? "");
      }
    }
    const direct = clean(chunks.join(" "));
    return direct || clean(element.textContent ?? "");
  };

  const click = (element: Element): void => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    if (element instanceof HTMLElement) {
      element.click();
    }
  };

  const snapshot = (note: string): void => {
    const dialogs = collect(document)
      .filter((element) => element.getAttribute("role") === "dialog" && visible(element))
      .slice(0, 4)
      .map((element) => clean(element.textContent ?? "").slice(0, 180));
    const buttons = collect(document)
      .filter((element) => element instanceof HTMLButtonElement && visible(element))
      .slice(0, 12)
      .map((element) =>
        clean(element.getAttribute("name") || element.getAttribute("aria-label") || element.textContent || "").slice(0, 60),
      );
    log(note, { dialogs, buttons, path: currentCategoryText() });
  };

  const sourceSegments = (): string[] => {
    const raw = Array.isArray(category?.path) && category.path.length > 0 ? category.path : [category?.name ?? ""];
    const segments: string[] = [];
    for (const part of raw) {
      const name = clean(String(part ?? ""));
      if (!name || /^(ebay|home|see more|n\/a|none|select|\.{3}|…)$/i.test(name)) {
        continue;
      }
      if (segments.some((existing) => normalize(existing) === normalize(name))) {
        continue;
      }
      segments.push(name);
    }
    return segments;
  };

  const pathsAlign = (segments: string[], targetText: string): boolean => {
    const target = normalize(targetText);
    if (!target || segments.length === 0) {
      return false;
    }
    const leaf = segments[segments.length - 1] ?? "";
    if (!leaf || !target.includes(normalize(leaf))) {
      return false;
    }
    return segments.slice(-3).every((segment) => target.includes(normalize(segment)));
  };

  const isStoreSection = (element: Element): boolean => {
    const section = element.closest("section, fieldset, [class*='summary'], [class*='category']");
    const heading = section?.querySelector("h1, h2, h3, h4, legend, label");
    return /store categor/i.test(clean(heading?.textContent ?? ""));
  };

  const findCategoryButton = (): HTMLButtonElement | undefined =>
    collect(document).find(
      (element): element is HTMLButtonElement =>
        element instanceof HTMLButtonElement &&
        element.getAttribute("name") === "categoryId" &&
        visible(element) &&
        !isStoreSection(element),
    );

  const currentCategoryText = (): string => {
    const button = findCategoryButton();
    const buttonText = clean(button?.textContent ?? "");
    const secondary = button?.parentElement?.querySelector("[class*='breadcrumb'], [class*='path']");
    const secondaryText =
      secondary && secondary !== button ? clean(secondary.textContent ?? "") : "";
    return clean(`${buttonText} ${secondaryText}`);
  };

  const categoryDialogs = (): Element[] =>
    collect(document).filter((element) => {
      const role = element.getAttribute("role");
      if ((role !== "dialog" && role !== "alertdialog") || !visible(element)) {
        return false;
      }
      const label = `${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`;
      return /categor/i.test(label);
    });

  const findSettingsSheet = (): Element | undefined => {
    const dialog = categoryDialogs().find((element) => /first category/i.test(element.textContent ?? ""));
    if (dialog) {
      return dialog;
    }
    const label = collect(document).find(
      (element) => visible(element) && /^first category$/i.test(ownText(element)),
    );
    return label?.closest("[role='dialog'], [role='alertdialog'], section, form") ?? undefined;
  };

  const findSearchInput = (): HTMLInputElement | undefined => {
    const scopes = [
      ...categoryDialogs(),
      ...collect(document).filter((element) => element.getAttribute("role") === "listbox" && visible(element)),
    ];
    const consider = (input: HTMLInputElement): boolean => {
      if (!visible(input) || input.disabled) {
        return false;
      }
      if (input.type === "hidden" || input.type === "radio" || input.type === "checkbox") {
        return false;
      }
      const hint = `${input.placeholder} ${input.getAttribute("aria-label") ?? ""} ${input.name}`;
      return !/store/i.test(hint);
    };
    for (const scope of scopes) {
      for (const input of scope.querySelectorAll("input, textarea")) {
        if (input instanceof HTMLInputElement && consider(input)) {
          return input;
        }
      }
    }
    return collect(document).find(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement &&
        consider(element) &&
        /categor|keyword|search/i.test(
          `${element.placeholder} ${element.getAttribute("aria-label") ?? ""} ${element.name}`,
        ),
    );
  };

  const findItemCategoryEdit = (): HTMLElement | undefined =>
    collect(document).find((element): element is HTMLElement => {
      if (!(element instanceof HTMLElement) || !visible(element)) {
        return false;
      }
      if (element.closest("[role='dialog'], [role='alertdialog']")) {
        return false;
      }
      const label = clean(`${element.getAttribute("aria-label") ?? ""} ${ownText(element)}`);
      if (!/^edit$|^change$|edit item category|edit category/i.test(label)) {
        return false;
      }
      if (/store/i.test(label) || isStoreSection(element)) {
        return false;
      }
      const container = element.closest("section, fieldset, form, div");
      const around = clean(container?.textContent ?? "");
      return /item category|^category\b/i.test(around) && !/store categor/i.test(label);
    });

  const clickNamed = (root: ParentNode, names: string[]): boolean => {
    const buttons = collect(root).filter(
      (element) => (element instanceof HTMLButtonElement || element.getAttribute("role") === "button") && visible(element),
    );
    for (const name of names) {
      const button = buttons.find((element) => clean(element.textContent ?? "").toLowerCase() === name.toLowerCase());
      if (button) {
        log(`click ${name}`);
        click(button);
        return true;
      }
    }
    return false;
  };

  const closeStrayDialogs = (): void => {
    for (const element of collect(document)) {
      const role = element.getAttribute("role");
      if ((role !== "dialog" && role !== "alertdialog") || !visible(element)) {
        continue;
      }
      const label = `${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`;
      if (/categor/i.test(label)) {
        continue;
      }
      const close = collect(element).find(
        (candidate) =>
          candidate instanceof HTMLButtonElement &&
          visible(candidate) &&
          /close|dismiss/i.test(candidate.getAttribute("aria-label") ?? candidate.textContent ?? ""),
      );
      if (close) {
        log("close non-category dialog");
        click(close);
      }
    }
  };

  const clickFirstCategory = (): boolean => {
    const sheet = findSettingsSheet();
    if (!sheet) {
      return false;
    }
    const label = collect(sheet).find((element) => /^first category$/i.test(ownText(element)));
    const container = label?.parentElement ?? sheet;
    const button = collect(container).find((element) => {
      if (!(element instanceof HTMLElement) || !visible(element) || element === label) {
        return false;
      }
      const text = clean(element.textContent ?? "");
      if (!text || /^(done|cancel|close|back)$/i.test(text) || /store categor/i.test(text)) {
        return false;
      }
      return element instanceof HTMLButtonElement || element.getAttribute("role") === "button" || element.tagName === "A";
    });
    if (!button) {
      return false;
    }
    log("open first category", clean(button.textContent ?? "").slice(0, 160));
    click(button);
    return true;
  };

  const waitFor = async (predicate: () => boolean, timeout: number): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (predicate()) {
        return true;
      }
      await delay(200);
    }
    return predicate();
  };

  const setSearchValue = (input: HTMLInputElement, value: string): void => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
  };

  const resultIdentity = (element: Element): string => {
    const radio =
      element instanceof HTMLInputElement
        ? element
        : element.querySelector("input[type='radio'], input[type='checkbox']");
    const value = radio instanceof HTMLInputElement ? radio.value : "";
    if (/^\d{2,}$/.test(value) && value !== "0") {
      return value;
    }
    for (const attr of ["data-category-id", "data-id", "data-value"]) {
      const attrValue = element.getAttribute(attr) ?? "";
      if (/^\d{2,}$/.test(attrValue) && attrValue !== "0") {
        return attrValue;
      }
    }
    return "";
  };

  const rankedResults = (): Array<{ element: Element; score: number; text: string }> => {
    const input = findSearchInput();
    const scope = input?.closest("[role='dialog'], [role='listbox']") ?? findSettingsSheet() ?? document;
    const segments = sourceSegments();
    const leaf = segments[segments.length - 1] ?? "";
    const parent = segments.length > 1 ? segments[segments.length - 2] ?? "" : "";
    const sourceId = clean(category?.id ?? "");
    const ranked: Array<{ element: Element; score: number; text: string }> = [];
    for (const element of collect(scope)) {
      if (!visible(element)) {
        continue;
      }
      const text = clean(element.textContent ?? "");
      if (!text || text.length > 400 || /store categor/i.test(text)) {
        continue;
      }
      if (/^(done|cancel|close|back|continue|select|apply|search|clear)$/i.test(text)) {
        continue;
      }
      const radios = element.querySelectorAll("input[type='radio']");
      const actionable =
        element.getAttribute("role") === "option" ||
        element.getAttribute("role") === "radio" ||
        element instanceof HTMLLabelElement ||
        (radios.length === 1 && element.querySelector("input[type='search'], textarea") === null);
      if (!actionable || radios.length > 1) {
        continue;
      }
      const norm = normalize(text);
      const resultId = resultIdentity(element);
      let score = 0;
      if (sourceId && resultId === sourceId) {
        score = 1000;
      } else if (sourceId && norm.includes(normalize(sourceId))) {
        score = 900;
      } else if (segments.length > 0 && segments.every((segment) => norm.includes(normalize(segment)))) {
        score = 800;
      } else if (leaf && parent && norm.includes(normalize(leaf)) && norm.includes(normalize(parent))) {
        score = 600;
      } else if (leaf && normalize(leaf).length >= 6 && norm.includes(normalize(leaf))) {
        score = 400;
      }
      if (score > 0) {
        ranked.push({ element, score, text });
      }
    }
    ranked.sort((left, right) => right.score - left.score || left.text.length - right.text.length);
    return ranked;
  };

  const searchAndPick = async (query: string): Promise<boolean> => {
    const input = findSearchInput();
    if (!input || !query) {
      return false;
    }
    log("search", query);
    setSearchValue(input, query);
    await delay(400);
    await waitFor(() => rankedResults().length > 0, 5000);
    const best = rankedResults()[0];
    if (!best) {
      log("no result", query);
      return false;
    }
    const radio = best.element.querySelector("input[type='radio']");
    log("pick", { score: best.score, text: best.text.slice(0, 180) });
    click(radio instanceof HTMLElement ? radio : best.element);
    await delay(400);
    const scope = best.element.closest("[role='dialog']") ?? document;
    clickNamed(scope, ["Continue", "Select", "Apply"]);
    await delay(300);
    return true;
  };

  const openPicker = async (): Promise<"picker" | "sheet" | "missing" | "closed"> => {
    if (findSearchInput()) {
      return "picker";
    }
    if (findSettingsSheet()) {
      clickFirstCategory();
      if (await waitFor(() => Boolean(findSearchInput()), 5000)) {
        return "picker";
      }
      return "sheet";
    }
    const categoryButton = findCategoryButton();
    const editButton = findItemCategoryEdit();
    if (!categoryButton && !editButton) {
      return "missing";
    }
    if (categoryButton) {
      log("click category button");
      click(categoryButton);
    }
    const opened = await waitFor(() => Boolean(findSearchInput() || findSettingsSheet()), categoryButton ? 5000 : 8000);
    if (!opened && editButton) {
      log("click item category edit");
      click(editButton);
      await waitFor(() => Boolean(findSearchInput() || findSettingsSheet()), 8000);
    }
    if (findSettingsSheet() && !findSearchInput()) {
      clickFirstCategory();
      if (await waitFor(() => Boolean(findSearchInput()), 5000)) {
        return "picker";
      }
      return findSettingsSheet() ? "sheet" : "closed";
    }
    if (findSearchInput()) {
      return "picker";
    }
    return findSettingsSheet() ? "sheet" : "closed";
  };

  const finishDialog = async (): Promise<void> => {
    const sheet = findSettingsSheet();
    if (sheet) {
      const segments = sourceSegments();
      await waitFor(() => pathsAlign(segments, clean(sheet.textContent ?? "")), 5000);
      clickNamed(sheet, ["Done"]);
      await delay(300);
      const stillOpen = findSettingsSheet();
      if (stillOpen) {
        clickNamed(stillOpen, ["Done"]);
      }
      return;
    }
    const dialog = categoryDialogs()[0];
    if (!dialog) {
      return;
    }
    clickNamed(dialog, ["Done"]);
    await delay(300);
    const remaining = categoryDialogs()[0];
    if (remaining) {
      const dismissed =
        clickNamed(remaining, ["Done", "Close"]) ||
        Boolean(
          collect(remaining).find((element) => {
            if (!(element instanceof HTMLButtonElement) || !visible(element)) {
              return false;
            }
            if (!/close|dismiss/i.test(element.getAttribute("aria-label") ?? "")) {
              return false;
            }
            click(element);
            return true;
          }),
        );
      if (!dismissed) {
        log("category dialog stayed open");
      }
    }
  };

  const segments = sourceSegments();
  const leaf = segments[segments.length - 1] ?? "";
  const sourceId = clean(category?.id ?? "");
  log("start", { id: sourceId, name: leaf, path: segments });
  if (!leaf && !sourceId) {
    return { ok: false, itemCategory: false, reason: "Source has no category name or id" };
  }
  const current = currentCategoryText();
  log("current", current);
  if (pathsAlign(segments, current)) {
    return { ok: true, itemCategory: true, reason: "already set" };
  }

  closeStrayDialogs();
  await delay(200);
  const opened = await openPicker();
  log("picker", opened);
  if (opened === "missing") {
    snapshot("Could not find Item category Edit or button[name=categoryId]");
    return {
      ok: false,
      itemCategory: false,
      reason: "Could not find Item category Edit or button[name=categoryId]",
    };
  }
  if (opened === "closed") {
    snapshot("Item category picker did not open");
    return { ok: false, itemCategory: false, reason: "Item category picker did not open" };
  }

  let picked = false;
  if (opened === "picker") {
    picked = await searchAndPick(leaf);
    if (!picked && sourceId) {
      picked = await searchAndPick(sourceId);
    }
    if (!picked) {
      snapshot(`No matching category for ${leaf || sourceId}`);
      return {
        ok: false,
        itemCategory: false,
        reason: `No matching category for ${leaf || sourceId}`,
      };
    }
  }

  await finishDialog();
  await waitFor(() => categoryDialogs().length === 0, 5000);
  const applied = await waitFor(() => pathsAlign(segments, currentCategoryText()), 5000);
  const ok = applied || picked;
  if (!ok) {
    snapshot("Category verification failed");
  }
  log("done", { applied, picked, current: currentCategoryText() });
  return {
    ok,
    itemCategory: ok,
    reason: ok ? "updated" : `Category verification failed. Current category is "${currentCategoryText()}".`,
  };
}
