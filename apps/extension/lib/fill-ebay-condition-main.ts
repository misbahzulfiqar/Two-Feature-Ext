export type FillItemConditionMainResult = {
  ok: boolean;
  condition: boolean;
  conditionDescription: boolean;
  reason: string;
};

export type FillItemConditionMainArg = {
  condition: string;
  conditionDescription: string;
};

/**
 * Runs in the listing page MAIN world so eBay React sees the same DOM
 * events as a real click. Do not close over module scope — Chrome
 * serializes this function into the page.
 *
 * Empty-state UI is three pills: New | Used | ...
 * "New other (see details)" is behind the ellipsis, then the
 * condition-description textarea appears after that choice is selected.
 */
export async function fillItemConditionInPage(
  payload: FillItemConditionMainArg,
): Promise<FillItemConditionMainResult> {
  const log = (step: string, detail?: unknown): void => {
    if (detail === undefined) {
      console.log(`[SellSimilar][condition] ${step}`);
      return;
    }
    console.log(`[SellSimilar][condition] ${step}`, detail);
  };

  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const normalize = (text: string): string =>
    text
      .replace(/\u00a0/g, " ")
      .replace(/[“”«»]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  const compact = (text: string): string =>
    normalize(text).replace(/[^a-z0-9]/gi, "").toLowerCase();

  const conditionKey = (text: string): string => compact(text).replace(/seedetails/g, "");

  const collapseRepeated = (text: string): string => {
    const n = normalize(text);
    const key = compact(n);
    if (key.length >= 4 && key.length % 2 === 0 && key.slice(0, key.length / 2) === key.slice(key.length / 2)) {
      return collapseRepeated(n.slice(0, Math.max(1, Math.floor(n.length / 2))));
    }
    return n;
  };

  const canonicalCondition = (raw: string): string => {
    const n = collapseRepeated(raw);
    if (!n) return "";
    const key = conditionKey(n);
    const known = [
      "New other (see details)",
      "New with defects",
      "Certified - Refurbished",
      "Seller refurbished",
      "For parts or not working",
      "Open box",
      "New",
      "Used",
    ];
    for (const label of known) {
      const labelKey = conditionKey(label);
      if (!labelKey) continue;
      if (key === labelKey || key.startsWith(labelKey)) {
        if (labelKey === "new" && (key.startsWith("newother") || key.startsWith("newwithdefects"))) {
          continue;
        }
        return label;
      }
    }
    return n.split(/[:\n]/)[0]?.trim() || n;
  };

  const labelsMatch = (left: string, right: string): boolean => {
    if (!left || !right) return false;
    const a = conditionKey(left);
    const b = conditionKey(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length > b.length ? a : b;
    if (shorter === "new" && longer.startsWith("newother")) return false;
    if (shorter === "used" && (longer === "used" || longer === "usedused")) return true;
    if (shorter === "used" && longer !== "used") return false;
    return longer.startsWith(shorter) && shorter.length >= 7;
  };

  const wantedIds = (wanted: string): string[] => {
    const key = conditionKey(wanted);
    if (key === "used") return ["3000"];
    if (key === "new") return ["1000"];
    if (key === "newother") return ["1500"];
    if (key === "newwithdefects") return ["1750"];
    if (key === "certifiedrefurbished" || key === "manufacturerrefurbished") {
      return ["2000", "2010"];
    }
    if (key === "sellerrefurbished") return ["2500"];
    if (key === "openbox" || key === "newopenbox") return ["1500", "2750"];
    if (key === "forpartsornotworking" || key === "forparts") return ["7000"];
    return [];
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
      aria: el.getAttribute("aria-label"),
      text: normalize(el.textContent ?? "").slice(0, 120),
    });
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
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

  const visibleText = (el: HTMLElement): string => {
    const labeled = el.querySelector<HTMLElement>(
      ".filter-button__text, .btn__text, .radio__label, .listbox__value, .menu__item-label",
    );
    const raw = normalize(
      labeled?.textContent ?? el.getAttribute("aria-label") ?? el.textContent ?? "",
    );
    return (raw.split("\n")[0] ?? "").replace(/\s*[ⓘi]$/u, "").trim();
  };

  const cardPills = (root: ParentNode): HTMLElement[] => {
    const found: HTMLElement[] = [];
    for (const node of root.querySelectorAll("button, [role='button'], .filter-button")) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      if (node.querySelectorAll("button, [role='button']").length > 0) continue;
      found.push(node);
    }
    return found;
  };

  const conditionCard = (): HTMLElement | null => {
    const byInflow = document.querySelector('[inflow*="condition"]');
    if (byInflow instanceof HTMLElement) return byInflow;

    const byClass = document.querySelector(".summary__condition, .smry.summary__condition");
    if (byClass instanceof HTMLElement) return byClass;

    for (const heading of document.querySelectorAll("h2, h3, h4, legend, span, label, .textual-display")) {
      if (!/^item condition$/i.test(normalize(heading.textContent ?? ""))) continue;
      if (!(heading instanceof HTMLElement)) continue;
      let current: HTMLElement | null = heading;
      while (current && current !== document.body) {
        const labels = cardPills(current).map(visibleText);
        if (labels.some((label) => /^new$/i.test(label)) && labels.some((label) => /^used$/i.test(label))) {
          return current;
        }
        current = current.parentElement;
      }
      const fallback = heading.closest("section, fieldset, .smry, [class*='summary']");
      if (fallback instanceof HTMLElement) return fallback;
    }

    for (const el of document.querySelectorAll("div, section, fieldset")) {
      if (!(el instanceof HTMLElement) || !isShown(el)) continue;
      const text = normalize(el.innerText ?? "");
      if (!/add the condition of your item/i.test(text)) continue;
      if (cardPills(el).length >= 2) return el;
    }
    return null;
  };

  const isEllipsisPill = (el: HTMLElement): boolean => {
    const raw = visibleText(el);
    const text = raw.replace(/\s/g, "");
    const aria = normalize(
      `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""} ${raw}`,
    );
    if (/^(…|⋯|•••|\.{2,3}|more)$/i.test(text)) return true;
    if (text.length <= 12 && /(\.{2,3}|…|⋯)/.test(text) && !/new|used/i.test(text)) return true;
    return /view more|see more|show more|more options|more condition/i.test(aria);
  };

  const isWantedChoice = (el: HTMLElement, wanted: string): boolean => {
    const title = visibleText(el);
    if (!title || /undo|access key/i.test(title)) return false;
    if (/^(done|cancel|close|save|continue|apply|update|edit|more)$/i.test(title)) return false;
    if (isEllipsisPill(el)) return false;
    const key = conditionKey(title);
    const want = conditionKey(wanted);
    if (key === "new" && want !== "new") return false;
    if (key === "used" && want !== "used") return false;
    if (labelsMatch(title, wanted)) return true;
    const input =
      el instanceof HTMLInputElement ? el : el.querySelector("input[type='radio']");
    return input instanceof HTMLInputElement && wantedIds(wanted).includes(input.value);
  };

  const isConditionSurface = (el: HTMLElement): boolean => {
    const text = normalize(el.innerText ?? "").toLowerCase();
    if (/undo\s*-\s*access key/.test(text) && !/new other|item condition/.test(text)) {
      return false;
    }
    return (
      /item condition|add the condition of your item/.test(text) ||
      /new other|new with defects|open box|for parts or not working|condition description/.test(
        text,
      ) ||
      Boolean(
        el.querySelector(
          'input[name*="condition" i], textarea[name="conditionDescription"], textarea[name*="conditionDescription" i]',
        ),
      )
    );
  };

  const overflowMenu = (): HTMLElement | null => {
    const nodes = document.querySelectorAll(
      '[role="menu"], [role="listbox"], .menu, .menu__items, .listbox, .listbox__options, .filter-menu, .popover, .tooltip--expanded, .listbox-button__listbox, .fake-menu',
    );
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      if (isConditionSurface(node)) return node;
    }
    for (const expanded of document.querySelectorAll('[aria-expanded="true"]')) {
      if (!(expanded instanceof HTMLElement)) continue;
      const id = expanded.getAttribute("aria-controls");
      if (!id) continue;
      const controlled = document.getElementById(id);
      if (controlled instanceof HTMLElement && isShown(controlled)) return controlled;
    }
    return null;
  };

  const conditionPanel = (): HTMLElement | null => {
    const nodes = document.querySelectorAll(
      '.lightbox-dialog, [role="dialog"], .drawer, .se-panel-container, .lightbox-dialog__window',
    );
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isShown(node) || node.hasAttribute("hidden")) {
        continue;
      }
      if (isConditionSurface(node)) return node;
    }
    return null;
  };

  const findWantedChoice = (wanted: string): HTMLElement | null => {
    const roots: ParentNode[] = [];
    const panel = conditionPanel();
    const menu = overflowMenu();
    const card = conditionCard();
    if (menu) roots.push(menu);
    if (panel) roots.push(panel);
    if (card) roots.push(card);
    roots.push(document);
    for (const root of roots) {
      const nodes = [
        ...cardPills(root),
        ...root.querySelectorAll(
          'input[type="radio"], [role="radio"], [role="option"], [role="menuitem"], [role="menuitemradio"], label, li, button, .filter-button',
        ),
      ];
      for (const node of nodes) {
        if (!(node instanceof HTMLElement) || !isShown(node)) continue;
        if (isWantedChoice(node, wanted)) return node;
      }
    }
    return null;
  };

  const selectedCondition = (): string => {
    const card = conditionCard();
    if (!card) return "";
    const selected = card.querySelector<HTMLElement>(
      'button[aria-pressed="true"], [aria-checked="true"], .filter-button--selected, .btn--selected, input[type="radio"]:checked',
    );
    if (selected) {
      const title =
        selected instanceof HTMLInputElement
          ? visibleText((selected.closest("label, .radio, .field, .filter-button") as HTMLElement) ?? selected)
          : visibleText(selected);
      if (title && !isEllipsisPill(selected) && !/^(new|used)$/i.test(title)) return title;
      if (title && /^(new|used)$/i.test(title)) return title;
    }
    const valueBtn = card.querySelector<HTMLElement>(
      'button[name="condition"], button[aria-label*="Item condition" i], .listbox-button__value, a.fake-link',
    );
    if (valueBtn) {
      const fromValue = visibleText(valueBtn);
      const emptyPills = siblingPills(card);
      const showingChooser =
        emptyPills.some((el) => /^new$/i.test(visibleText(el))) &&
        emptyPills.some((el) => /^used$/i.test(visibleText(el)));
      if (
        fromValue &&
        !/^(item condition|add the condition)$/i.test(fromValue) &&
        !isEllipsisPill(valueBtn) &&
        (!showingChooser || !/^(new|used)$/i.test(fromValue))
      ) {
        return fromValue;
      }
      if (fromValue && /^(new|used)$/i.test(fromValue) && !showingChooser) {
        return fromValue;
      }
    }
    return "";
  };

  const setNativeValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
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
  };

  const descriptionInput = (): HTMLTextAreaElement | HTMLInputElement | null => {
    const named = document.querySelector(
      'textarea[name="conditionDescription"], textarea[name*="conditionDescription" i], textarea[aria-label*="Condition description" i]',
    );
    if (
      (named instanceof HTMLTextAreaElement || named instanceof HTMLInputElement) &&
      isShown(named)
    ) {
      return named;
    }

    const roots: ParentNode[] = [];
    const panel = conditionPanel();
    const card = conditionCard();
    if (panel) roots.push(panel);
    if (card) roots.push(card);
    roots.push(document);

    for (const root of roots) {
      for (const label of root.querySelectorAll("label, .textual-display, span, h3, h4, legend")) {
        if (
          !/^(condition description|condition details|describe the condition)$/i.test(
            normalize(label.textContent ?? ""),
          )
        ) {
          continue;
        }
        const wrap = label.closest("div, fieldset, section, label") ?? root;
        const input = wrap.querySelector("textarea, input[type='text']");
        if (
          (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) &&
          isShown(input)
        ) {
          return input;
        }
      }
    }
    return null;
  };

  const applyDescription = (wanted: string): boolean => {
    if (!wanted) return false;
    const input = descriptionInput();
    if (!input) {
      log("description field not found");
      return false;
    }
    const maxLength = input.maxLength > 0 ? input.maxLength : 1000;
    const next = wanted.slice(0, maxLength);
    input.focus();
    setNativeValue(input, next);
    input.blur();
    const current = compact(input.value);
    const expected = compact(next);
    const ok = current === expected || current.includes(expected) || expected.includes(current);
    log("description applied", { ok, length: next.length });
    return ok;
  };

  const siblingPills = (card: HTMLElement): HTMLElement[] => {
    const pills = cardPills(card);
    const anchor = pills.find((el) => /^(new|used)$/i.test(visibleText(el)));
    if (!anchor?.parentElement) return pills;
    return cardPills(anchor.parentElement);
  };

  const clickEllipsis = (card: HTMLElement): boolean => {
    const pills = siblingPills(card);
    const more = pills.find(isEllipsisPill);
    if (more) {
      fireClick(more, "more conditions");
      return true;
    }
    const overflow = pills.find((el) => !/^(new|used)$/i.test(visibleText(el)));
    if (overflow) {
      fireClick(overflow, "more conditions (last short pill)");
      return true;
    }
    return false;
  };

  const confirmConditionPanel = (): boolean => {
    const panel = conditionPanel();
    if (!panel) return false;
    const selectors = [
      ".se-panel-container__header-suffix button",
      'button[_track$=".Done"]',
      "footer button.btn--primary",
      ".lightbox-dialog__footer button.btn--primary",
    ];
    for (const selector of selectors) {
      for (const node of panel.querySelectorAll<HTMLElement>(selector)) {
        if (!isShown(node)) continue;
        const text = visibleText(node);
        if (/^(cancel|close|read more)$/i.test(text)) continue;
        fireClick(node, "confirm condition");
        return true;
      }
    }
    for (const node of panel.querySelectorAll<HTMLElement>("button, [role='button']")) {
      if (!isShown(node)) continue;
      if (/^(done|continue|save|apply|update)$/i.test(visibleText(node))) {
        fireClick(node, "confirm condition");
        return true;
      }
    }
    return false;
  };

  const selectChoice = (node: HTMLElement): void => {
    const radio =
      node instanceof HTMLInputElement ? node : node.querySelector("input[type='radio']");
    log("selecting", visibleText(node));
    if (radio instanceof HTMLElement) fireClick(radio, "condition radio");
    if (!(radio instanceof HTMLElement) || radio !== node) {
      fireClick(node, "condition option");
    }
  };

  const isEbayConditionBlurb = (text: string): boolean => {
    const compactText = compact(text);
    if (!compactText) return true;
    if (compactText.includes("seethesellerslistingforfulldetails")) return true;
    if (compactText.includes("abrandnewunusedunopenedundamaged")) return true;
    if (compactText.includes("initsoriginalpackagingwherepackagingisapplicable")) return true;
    if (compactText.includes("anitemthathasbeenusedpreviously")) return true;
    return false;
  };

  const wanted = canonicalCondition(payload.condition);
  const wantedDescription = isEbayConditionBlurb(payload.conditionDescription)
    ? ""
    : normalize(payload.conditionDescription).replace(/^["']+|["']+$/g, "");
  if (!wanted && !wantedDescription) {
    return { ok: false, condition: false, conditionDescription: false, reason: "No condition" };
  }

  try {
    log("MAIN-world start", {
      wanted,
      wantedDescription,
      current: selectedCondition(),
    });

    const card = conditionCard();
    log("condition card", {
      found: Boolean(card),
      pills: card ? siblingPills(card).map(visibleText) : [],
    });

    const chooserVisible = (): boolean => {
      const host = conditionCard();
      if (!host) return false;
      const labels = siblingPills(host).map(visibleText);
      return labels.some((label) => /^new$/i.test(label)) && labels.some((label) => /^used$/i.test(label));
    };

    const clickLabeledCondition = (wanted: string): HTMLElement | null => {
      const want = conditionKey(wanted);
      const roots: ParentNode[] = [];
      const host = conditionCard();
      const menu = overflowMenu();
      const panel = conditionPanel();
      if (menu) roots.push(menu);
      if (panel) roots.push(panel);
      if (host) roots.push(host);
      roots.push(document);

      for (const root of roots) {
        for (const textEl of root.querySelectorAll(
          ".filter-button__text, .btn__text, .radio__label, button, [role='button'], [role='radio'], label, .filter-button",
        )) {
          if (!(textEl instanceof HTMLElement)) continue;
          const title = visibleText(textEl);
          if (conditionKey(title) !== want) continue;
          if (/undo|access key|read more|more information/i.test(title)) continue;
          const hostEl =
            textEl.closest("button, [role='button'], .filter-button, label, [role='radio']") ?? textEl;
          if (!(hostEl instanceof HTMLElement)) continue;
          if (isEllipsisPill(hostEl)) continue;
          if (!isShown(hostEl) && !(hostEl instanceof HTMLInputElement)) continue;
          selectChoice(hostEl);
          return hostEl;
        }
      }

      const ids = new Set(wantedIds(wanted));
      if (ids.size === 0) return null;
      for (const input of document.querySelectorAll('input[type="radio"]')) {
        if (!(input instanceof HTMLInputElement) || !ids.has(input.value)) continue;
        const hostEl =
          (input.closest("label, .filter-button, .radio, button, .field") as HTMLElement | null) ?? input;
        selectChoice(hostEl);
        return hostEl;
      }
      return null;
    };

    const openChooser = async (): Promise<void> => {
      if (chooserVisible()) return;
      const host = conditionCard();
      if (!host) return;
      const valueBtn =
        host.querySelector<HTMLElement>(
          'button[name="condition"], button[aria-label*="Item condition" i], a.fake-link, button.listbox-button__control, button.value',
        ) ??
        [...host.querySelectorAll("button, a, [role='button']")].find((el): el is HTMLElement => {
          if (!(el instanceof HTMLElement) || !isShown(el)) return false;
          const title = visibleText(el);
          return /^(new|used|new other)/i.test(title) && !isEllipsisPill(el);
        }) ??
        null;
      if (!valueBtn) return;
      fireClick(valueBtn, "reopen condition chooser");
      await waitUntil(() => chooserVisible() || Boolean(conditionPanel()), 2500);
    };

    let conditionOk = Boolean(wanted) && labelsMatch(selectedCondition(), wanted);

    if (wanted && !conditionOk) {
      await openChooser();
      let choice = findWantedChoice(wanted) ?? clickLabeledCondition(wanted);
      const primary = conditionKey(wanted) === "new" || conditionKey(wanted) === "used";
      if (!choice && !primary) {
        const host = conditionCard();
        if (host) {
          clickEllipsis(host);
          await waitUntil(
            () => Boolean(findWantedChoice(wanted) || overflowMenu() || conditionPanel()),
            2500,
          );
          choice = findWantedChoice(wanted) ?? clickLabeledCondition(wanted);
        }
      }

      if (!choice) {
        log("no matching option", {
          wanted,
          pills: conditionCard() ? siblingPills(conditionCard() as HTMLElement).map(visibleText) : [],
          menu: overflowMenu() ? normalize(overflowMenu()?.innerText ?? "").slice(0, 300) : "",
        });
        return {
          ok: false,
          condition: false,
          conditionDescription: wantedDescription ? applyDescription(wantedDescription) : false,
          reason: `No matching condition for "${wanted}"`,
        };
      }

      if (!labelsMatch(selectedCondition(), wanted)) {
        selectChoice(choice);
      }
      await waitUntil(
        () => labelsMatch(selectedCondition(), wanted) || labelsMatch(visibleText(choice), wanted),
        2000,
      );
      conditionOk =
        labelsMatch(selectedCondition(), wanted) || labelsMatch(visibleText(choice), wanted);
    }

    let descriptionOk = false;
    if (wantedDescription) {
      await waitUntil(() => Boolean(descriptionInput()), 3000);
      descriptionOk = applyDescription(wantedDescription);
      if (!descriptionOk) {
        await delay(400);
        descriptionOk = applyDescription(wantedDescription);
      }
    }

    if (conditionPanel()) {
      confirmConditionPanel();
      await waitUntil(() => !conditionPanel(), 2000);
      if (wantedDescription && !descriptionOk) {
        await waitUntil(() => Boolean(descriptionInput()), 1500);
        descriptionOk = applyDescription(wantedDescription);
      }
    }

    conditionOk = conditionOk || labelsMatch(selectedCondition(), wanted);
    log("MAIN-world result", {
      current: selectedCondition(),
      conditionOk,
      descriptionOk,
    });
    return {
      ok: conditionOk || descriptionOk,
      condition: conditionOk,
      conditionDescription: wantedDescription ? descriptionOk : false,
      reason: conditionOk ? "updated" : `Listing still shows "${selectedCondition() || "unknown"}"`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log("MAIN-world error", reason);
    return { ok: false, condition: false, conditionDescription: false, reason };
  }
}
