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

  const firstLabelLine = (text: string): string =>
    normalize(text)
      .split("\n")
      .map((part) => part.replace(/\s*[ⓘi]$/u, "").trim())
      .find(
        (part) =>
          part.length > 0 &&
          part.length < 80 &&
          !/^(select|choose|edit|item condition|condition|done|cancel|close|save|continue|apply|update)$/i.test(
            part,
          ) &&
          !/^["“]/.test(part),
      ) ?? "";

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
      type: el.getAttribute("type"),
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

  const conditionSection = (): HTMLElement | null => {
    const byInflow = document.querySelector('[inflow*="condition"]');
    if (byInflow instanceof HTMLElement) return byInflow;
    const byClass = document.querySelector(".summary__condition, .smry.summary__condition");
    if (byClass instanceof HTMLElement) return byClass;
    for (const heading of document.querySelectorAll("h2, h3, .summary__header-label, .textual-display")) {
      if (!/^item condition$/i.test(normalize(heading.textContent ?? ""))) continue;
      const section = heading.closest(".smry, .summary__condition, section, [class*='summary']");
      if (section instanceof HTMLElement) return section;
    }
    return null;
  };

  const listingCondition = (): string => {
    const section = conditionSection();
    if (!section) return "";
    const button = section.querySelector<HTMLElement>(
      'button[name="condition"], button[aria-label*="Item condition" i], button.listbox-button__control, button.value, a.fake-link',
    );
    const valueEl = button?.querySelector<HTMLElement>(
      ".btn__text, .listbox-button__value, .filter-button__text",
    );
    const fromValue = firstLabelLine(valueEl?.innerText || valueEl?.textContent || "");
    if (fromValue) return fromValue;
    const fromAria = firstLabelLine(
      (button?.getAttribute("aria-label") ?? "").replace(/^(edit\s+)?item condition\s*/i, ""),
    );
    if (fromAria) return fromAria;
    if (button) {
      const fromControl = firstLabelLine(button.innerText || button.textContent || "");
      if (fromControl) return fromControl;
    }
    return firstLabelLine(section.innerText || "");
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
    const section = conditionSection() ?? document;
    const candidates = [
      ...section.querySelectorAll("textarea, input[type='text']"),
    ];
    for (const node of candidates) {
      if (!(node instanceof HTMLTextAreaElement) && !(node instanceof HTMLInputElement)) continue;
      if (node.closest(".lightbox-dialog, [role='dialog']")) continue;
      const name = `${node.getAttribute("name") ?? ""} ${node.getAttribute("aria-label") ?? ""}`;
      if (/conditionDescription|condition description/i.test(name)) return node;
    }
    for (const label of section.querySelectorAll("label, .textual-display, span, h3, h4")) {
      if (!/^condition description$/i.test(normalize(label.textContent ?? ""))) continue;
      const root = label.closest("div, fieldset, section") ?? section;
      const input = root.querySelector("textarea, input[type='text']");
      if (
        (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) &&
        !input.closest(".lightbox-dialog, [role='dialog']")
      ) {
        return input;
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

  const labelsMatch = (left: string, right: string): boolean => {
    if (!left || !right) return false;
    const a = compact(left).replace(/seedetails/g, "");
    const b = compact(right).replace(/seedetails/g, "");
    return a === b;
  };

  const wantedIds = (wanted: string): string[] => {
    const key = compact(wanted).replace(/seedetails/g, "");
    if (key === "used") return ["3000"];
    if (key === "new") return ["1000"];
    if (key === "newother" || key === "newothersee") return ["1500"];
    if (key === "newwithdefects") return ["1750"];
    if (key === "certifiedrefurbished" || key === "manufacturerrefurbished") {
      return ["2000", "2010"];
    }
    if (key === "sellerrefurbished") return ["2500"];
    if (key === "openbox" || key === "newopenbox") return ["1500", "2750"];
    if (key === "forpartsornotworking" || key === "forparts") return ["7000"];
    return [];
  };

  const visibleDialogs = (): HTMLElement[] => {
    const found: HTMLElement[] = [];
    document
      .querySelectorAll(
        '.lightbox-dialog, [role="dialog"], .drawer, .lightbox-dialog__window, [role="listbox"]',
      )
      .forEach((node) => {
        if (node instanceof HTMLElement && isShown(node) && !node.hasAttribute("hidden")) {
          found.push(node);
        }
      });
    return found;
  };

  const dialogHeader = (el: HTMLElement): string =>
    normalize(
      el.querySelector("h1, h2, .lightbox-dialog__header, .dialog__header")?.textContent ?? "",
    );

  const isForeignDialog = (el: HTMLElement): boolean => {
    const header = dialogHeader(el);
    const body = normalize(el.innerText ?? "").slice(0, 900).toLowerCase();
    return (
      /item category|select a category|search for a category/i.test(header) ||
      body.includes("first category") ||
      /add photos|upload photos|drag and drop/i.test(header + " " + body) ||
      /vehicle compatibility|compatible vehicles/i.test(header + " " + body)
    );
  };

  const isConditionDialogEl = (el: HTMLElement): boolean => {
    if (isForeignDialog(el)) return false;
    const header = dialogHeader(el);
    const body = normalize(el.innerText ?? "").slice(0, 900).toLowerCase();
    return (
      /item condition|select condition|choose condition|^condition$/i.test(header) ||
      /item condition|new other|see details|condition description/.test(body) ||
      Boolean(el.querySelector('input[name*="condition" i], input[type="radio"]'))
    );
  };

  const conditionDialog = (): HTMLElement | null => {
    const dialogs = visibleDialogs();
    for (const dialog of dialogs) {
      if (isConditionDialogEl(dialog)) return dialog;
    }
    for (const dialog of dialogs) {
      if (!isForeignDialog(dialog)) return dialog;
    }
    return null;
  };

  const optionTitle = (node: HTMLElement): string => {
    const valueEl = node.querySelector<HTMLElement>(
      ".radio__label, .field__label, .listbox__value, .listbox-button__value, .menu__item-label",
    );
    const fromValue = firstLabelLine(valueEl?.innerText || valueEl?.textContent || "");
    if (fromValue) return fromValue;
    const aria = node.getAttribute("aria-label") ?? "";
    if (aria && !/item condition/i.test(aria)) return firstLabelLine(aria);
    return firstLabelLine(node.innerText || node.textContent || "");
  };

  const findConditionChoice = (
    root: ParentNode,
    wanted: string,
  ): HTMLElement | null => {
    const ids = wantedIds(wanted);
    let best: { node: HTMLElement; rank: number; size: number } | null = null;
    const nodes = root.querySelectorAll(
      'input[type="radio"], [role="radio"], [role="option"], [role="menuitemradio"], label, .listbox__option, .radio, .field, li, button',
    );
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      if (node.querySelectorAll('input[type="radio"]').length > 1) continue;
      const input =
        node instanceof HTMLInputElement
          ? node
          : node.querySelector("input[type='radio']");
      const value = input instanceof HTMLInputElement ? input.value : "";
      const title = optionTitle(node);
      if (!title || /^(done|cancel|close|save|continue|apply|update|edit)$/i.test(title)) {
        continue;
      }
      let rank = 0;
      if (title && labelsMatch(title, wanted)) rank = 3;
      else if (value && ids.includes(value)) rank = 2;
      if (rank === 0) continue;
      if (!best || rank > best.rank || (rank === best.rank && title.length < best.size)) {
        best = { node, rank, size: title.length || 999 };
      }
    }
    return best?.node ?? null;
  };

  const clickLabeled = (root: ParentNode, pattern: RegExp, reason: string): boolean => {
    const buttons = root.querySelectorAll("button, a, [role='button']");
    for (const node of buttons) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      const text = normalize(node.textContent ?? "");
      const aria = node.getAttribute("aria-label") ?? "";
      if (pattern.test(text) || pattern.test(aria)) {
        fireClick(node, reason);
        return true;
      }
    }
    return false;
  };

  const confirmPicker = (dialog: HTMLElement): boolean => {
    const primary = dialog.querySelector<HTMLElement>(
      "footer button.btn--primary, .lightbox-dialog__footer button.btn--primary, button.btn--primary",
    );
    if (primary && isShown(primary)) {
      const text = normalize(primary.textContent ?? "");
      if (!/^(cancel|close)$/i.test(text)) {
        fireClick(primary, "confirm condition");
        return true;
      }
    }
    return clickLabeled(dialog, /^(done|continue|save|apply|update)$/i, "confirm condition");
  };

  const closeForeignDialogs = async (): Promise<void> => {
    for (const dialog of visibleDialogs()) {
      if (isConditionDialogEl(dialog)) continue;
      if (!isForeignDialog(dialog)) continue;
      const closeBtn = dialog.querySelector<HTMLElement>(
        'button.lightbox-dialog__close, button[aria-label*="Close" i]',
      );
      if (closeBtn) {
        fireClick(closeBtn, "close non-condition dialog");
        await delay(250);
      }
    }
  };

  const closePicker = (dialog: HTMLElement, reason: string): boolean => {
    const closeBtn = dialog.querySelector<HTMLElement>(
      'button.lightbox-dialog__close, button[aria-label*="Close" i], button[aria-label*="close" i]',
    );
    if (closeBtn && isShown(closeBtn)) {
      fireClick(closeBtn, reason);
      return true;
    }
    return clickLabeled(dialog, /^(cancel|close)$/i, reason);
  };

  const openPicker = async (): Promise<HTMLElement | null> => {
    const section = conditionSection();
    const toggle = section?.querySelector<HTMLElement>(
      'button[name="condition"], button[aria-label*="Item condition" i], button.listbox-button__control, button.value, button.fake-link, a.fake-link',
    );
    if (toggle && isShown(toggle)) {
      fireClick(toggle, "open condition picker");
    } else {
      const edit = section?.querySelector<HTMLElement>(
        'button[aria-label="Edit Item condition"], button.summary__header-edit-button',
      );
      if (edit && isShown(edit)) fireClick(edit, "edit item condition");
    }
    await waitUntil(() => Boolean(conditionDialog()), 2500);
    return conditionDialog();
  };

  const wanted = normalize(payload.condition);
  const wantedDescription = normalize(payload.conditionDescription).replace(/^["']+|["']+$/g, "");
  if (!wanted && !wantedDescription) {
    return { ok: false, condition: false, conditionDescription: false, reason: "No condition" };
  }

  try {
    log("MAIN-world start", { wanted, wantedDescription, current: listingCondition() });
    await closeForeignDialogs();
    let conditionOk = !wanted || (labelsMatch(listingCondition(), wanted) && !conditionDialog());
    if (conditionOk && wanted) {
      log("already set", listingCondition());
    } else if (wanted) {
      let dialog = conditionDialog() ?? (await openPicker());
      if (!dialog) {
        const descriptionOk = applyDescription(wantedDescription);
        return {
          ok: false,
          condition: false,
          conditionDescription: descriptionOk,
          reason: "Condition picker did not open",
        };
      }

      log("picker open", {
        header: normalize(
          dialog.querySelector("h1, h2, .lightbox-dialog__header")?.textContent ?? "",
        ),
        snippet: normalize(dialog.innerText ?? "").slice(0, 400),
      });

      const started = Date.now();
      let choice = findConditionChoice(dialog, wanted);
      while (!choice && Date.now() - started < 2500) {
        await delay(150);
        dialog = conditionDialog() ?? dialog;
        choice = findConditionChoice(dialog, wanted);
      }

      if (!choice) {
        log("no matching option", {
          wanted,
          options: [...dialog.querySelectorAll('input[type="radio"], [role="option"], label')]
            .filter((node): node is HTMLElement => node instanceof HTMLElement && isShown(node))
            .slice(0, 12)
            .map((node) => optionTitle(node)),
        });
        closePicker(dialog, "close unmatched condition picker");
        await waitUntil(() => !conditionDialog(), 2000);
        const descriptionOk = applyDescription(wantedDescription);
        return {
          ok: false,
          condition: false,
          conditionDescription: descriptionOk,
          reason: `No matching condition for "${wanted}"`,
        };
      }

      const radio =
        choice instanceof HTMLInputElement
          ? choice
          : choice.querySelector("input[type='radio']");
      log("selecting", optionTitle(choice));
      if (radio instanceof HTMLElement) fireClick(radio, "condition radio");
      if (!(radio instanceof HTMLElement) || radio !== choice) {
        fireClick(choice, "condition option");
      }
      await delay(250);

      dialog = conditionDialog() ?? dialog;
      if (dialog && isShown(dialog)) {
        const confirmed = confirmPicker(dialog);
        if (!confirmed) await delay(350);
      }

      let closed = await waitUntil(() => !conditionDialog(), 2000);
      if (!closed) {
        const leftover = conditionDialog();
        if (leftover) {
          if (!confirmPicker(leftover)) {
            closePicker(leftover, "force-close condition picker");
          }
          closed = await waitUntil(() => !conditionDialog(), 1500);
        }
      }

      const leftover = conditionDialog();
      if (leftover && isShown(leftover)) {
        closePicker(leftover, "dismiss leftover condition picker");
        await waitUntil(() => !conditionDialog(), 1500);
      }

      const current = listingCondition();
      conditionOk = labelsMatch(current, wanted);
      log("condition after pick", { current, conditionOk, dialogOpen: Boolean(conditionDialog()) });
    }

    const leftover = conditionDialog();
    if (leftover && isShown(leftover)) {
      closePicker(leftover, "dismiss leftover condition picker");
      await waitUntil(() => !conditionDialog(), 1500);
    }

    const descriptionOk = wantedDescription ? applyDescription(wantedDescription) : false;
    const matched = Boolean(conditionOk);
    log("MAIN-world result", {
      current: listingCondition(),
      matched,
      descriptionOk,
      dialogOpen: Boolean(conditionDialog()),
    });
    return {
      ok: matched || descriptionOk,
      condition: matched,
      conditionDescription: wantedDescription ? descriptionOk : false,
      reason: matched ? "updated" : `Listing still shows "${listingCondition() || "unknown"}"`,
    };
  } catch (error) {
    const leftover = conditionDialog();
    if (leftover) closePicker(leftover, "close after error");
    const reason = error instanceof Error ? error.message : String(error);
    log("MAIN-world error", reason);
    return { ok: false, condition: false, conditionDescription: false, reason };
  }
}
