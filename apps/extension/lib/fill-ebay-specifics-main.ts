export type FillItemYesNoMainResult = {
  ok: boolean;
  reason: string;
};

/**
 * Clicks eBay Yes/No filter-button pills in MAIN world.
 * Do not close over module scope — Chrome serializes this function into the page.
 */
export async function fillItemYesNoInPage(payload: {
  key: string;
  value: string;
}): Promise<FillItemYesNoMainResult> {
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const normalize = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const compact = (text: string): string =>
    normalize(text)
      .replace(/~\s*[\d.,]+\s*[kmb]?\s*searches/gi, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();

  const yesNo = (value: string): "yes" | "no" | null => {
    const trimmed = value.trim().toLowerCase();
    if (/^(yes|true)$/i.test(trimmed)) return "yes";
    if (/^(no|false)$/i.test(trimmed)) return "no";
    return null;
  };

  const isShown = (el: HTMLElement): boolean => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const fireClick = (el: HTMLElement): void => {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    el.click();
  };

  const setNativeChecked = (input: HTMLInputElement, checked: boolean): void => {
    const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
    const descriptor =
      Object.getOwnPropertyDescriptor(prototype, "checked") ??
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    descriptor?.set?.call(input, checked);
    if (input.checked !== checked) {
      input.checked = checked;
    }
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  };

  const wantedKey = compact(payload.key);
  const wanted = yesNo(payload.value);
  if (!wantedKey || !wanted) {
    return { ok: false, reason: "Not a yes/no specific" };
  }

  const expandMore = async (): Promise<void> => {
    const root = document.querySelector(".summary__attributes") ?? document;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const more = [...root.querySelectorAll("button, a, [role='button']")].find((el) =>
        /^(show more|see more|see all|more item specifics)/i.test(normalize(el.textContent ?? "")),
      );
      if (!(more instanceof HTMLElement) || !isShown(more)) return;
      fireClick(more);
      await delay(200);
    }
  };

  const fieldLabel = (field: Element): string => {
    const label = field.querySelector(".summary__attributes--label");
    if (!label) return "";
    const clone = label.cloneNode(true);
    if (!(clone instanceof Element)) return "";
    clone.querySelectorAll(".tooltip__overlay, .tooltip").forEach((node) => node.remove());
    return normalize(clone.textContent ?? "");
  };

  const labelMatches = (field: Element): boolean => {
    const key = compact(fieldLabel(field));
    return key === wantedKey || key.startsWith(wantedKey);
  };

  const findField = (): HTMLElement | null => {
    const root = document.querySelector(".summary__attributes") ?? document;
    for (const node of root.querySelectorAll('[data-testid="attribute"]')) {
      if (node instanceof HTMLElement && labelMatches(node)) return node;
    }
    return null;
  };

  const pillLabel = (pill: HTMLElement): string => {
    const labeled = normalize(pill.querySelector(".filter-button__text")?.textContent ?? "");
    if (/^(yes|no)$/i.test(labeled)) return labeled.toLowerCase();
    const text = normalize(pill.textContent ?? "").toLowerCase();
    if (/^(yes|no)$/i.test(text)) return text;
    const match = text.match(/\b(yes|no)\b/);
    return match?.[1] ?? text;
  };

  const pillSelected = (pill: HTMLElement): boolean => {
    const radio = pill.querySelector("input[type='radio']");
    if (radio instanceof HTMLInputElement && radio.checked) return true;
    return (
      pill.getAttribute("aria-pressed") === "true" ||
      pill.getAttribute("aria-checked") === "true" ||
      pill.getAttribute("aria-selected") === "true" ||
      pill.className.toLowerCase().includes("selected") ||
      pill.className.toLowerCase().includes("pressed") ||
      pill.className.toLowerCase().includes("checked")
    );
  };

  const clickNoPill = (field: HTMLElement): boolean => {
    const valueRoot = field.querySelector(".summary__attributes--value") ?? field;
    const pills = [...valueRoot.querySelectorAll(".filter-button, button, label, [role='radio']")].filter(
      (node): node is HTMLElement => node instanceof HTMLElement && isShown(node),
    );

    for (const pill of pills) {
      if (pillLabel(pill) !== wanted) continue;
      const target =
        pill.closest(".filter-button") instanceof HTMLElement
          ? (pill.closest(".filter-button") as HTMLElement)
          : pill;
      if (pillSelected(target)) return true;
      fireClick(target);
      const radio = target.querySelector("input[type='radio']");
      if (radio instanceof HTMLInputElement) {
        setNativeChecked(radio, true);
      }
      return true;
    }

    const radios = valueRoot.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      if (!(radio instanceof HTMLInputElement)) continue;
      const hay = [
        radio.value,
        radio.getAttribute("aria-label") ?? "",
        radio.labels?.[0]?.textContent ?? "",
        radio.closest("label")?.textContent ?? "",
        radio.closest(".filter-button")?.textContent ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!new RegExp(`\\b${wanted}\\b`).test(hay) && radio.value.trim().toLowerCase() !== wanted) {
        continue;
      }
      if (radio.checked) return true;
      const host = radio.closest(".filter-button, label, button") ?? radio;
      if (host instanceof HTMLElement) fireClick(host);
      setNativeChecked(radio, true);
      return true;
    }

    return false;
  };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await expandMore();
    const field = findField();
    if (field && clickNoPill(field)) {
      await delay(120);
      return { ok: true, reason: "updated" };
    }
    await delay(200);
  }

  return { ok: false, reason: `No ${wanted} pill for ${payload.key}` };
}

/**
 * Adds a source item specific that has no matching editor field via
 * eBay's "Add custom item specific" Name/Value modal.
 * Do not close over module scope — Chrome serializes this into the page.
 */
export async function addCustomItemSpecificInPage(payload: {
  key: string;
  value: string;
}): Promise<{ ok: boolean; reason: string }> {
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const normalize = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const compact = (text: string): string =>
    normalize(text)
      .replace(/~\s*[\d.,]+\s*[kmb]?\s*searches/gi, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();

  const isShown = (el: HTMLElement): boolean => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const fireClick = (el: HTMLElement): void => {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    el.click();
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
    input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const fieldLabel = (field: Element): string => {
    const label = field.querySelector(".summary__attributes--label");
    if (!label) return "";
    const clone = label.cloneNode(true);
    if (!(clone instanceof Element)) return "";
    clone.querySelectorAll(".tooltip__overlay, .tooltip").forEach((node) => node.remove());
    return normalize(clone.textContent ?? "");
  };

  const attributeRoot = (): ParentNode =>
    document.querySelector(".summary__attributes") ?? document;

  const fillFieldValue = (field: HTMLElement, nextValue: string): boolean => {
    const named = field.querySelector(
      'input[name^="attributes."]:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), textarea[name^="attributes."]',
    );
    if (named instanceof HTMLInputElement || named instanceof HTMLTextAreaElement) {
      named.focus();
      setNativeValue(named, nextValue);
      named.blur();
      return true;
    }
    const search = field.querySelector('input[name^="search-box-attributes"], input.textbox__control');
    if (search instanceof HTMLInputElement && isShown(search)) {
      search.focus();
      setNativeValue(search, nextValue);
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
      );
      search.blur();
      return true;
    }
    const fallback = field.querySelector("input[type='text'], textarea");
    if (fallback instanceof HTMLInputElement || fallback instanceof HTMLTextAreaElement) {
      fallback.focus();
      setNativeValue(fallback, nextValue);
      fallback.blur();
      return true;
    }
    return false;
  };

  const findField = (key: string): HTMLElement | null => {
    const wanted = compact(key);
    for (const node of attributeRoot().querySelectorAll('[data-testid="attribute"]')) {
      if (!(node instanceof HTMLElement)) continue;
      if (compact(fieldLabel(node)) === wanted) return node;
    }
    for (const label of attributeRoot().querySelectorAll(".summary__attributes--label, label")) {
      const text = compact(
        normalize(label.textContent ?? "").replace(/~\s*[\d.,]+\s*[kmb]?\s*searches/gi, ""),
      );
      if (text !== wanted) continue;
      const field = label.closest('[data-testid="attribute"], .field, li');
      if (field instanceof HTMLElement) return field;
    }
    return null;
  };

  const customDialog = (): HTMLElement | null => {
    for (const node of document.querySelectorAll(
      '.lightbox-dialog, [role="dialog"], .drawer, .lightbox-dialog__window',
    )) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      const heading = normalize(
        node.querySelector("h1, h2, .lightbox-dialog__header, .dialog__header")?.textContent ??
          node.innerText ??
          "",
      ).slice(0, 240);
      if (/add custom item specific/i.test(heading)) return node;
    }
    return null;
  };

  const associatedInput = (
    dialog: HTMLElement,
    label: Element,
  ): HTMLInputElement | HTMLTextAreaElement | null => {
    if (label instanceof HTMLLabelElement) {
      const control = label.control;
      if (
        (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) &&
        isShown(control)
      ) {
        return control;
      }
    }
    const forId = label.getAttribute("for");
    if (forId) {
      const byId = dialog.querySelector(`#${CSS.escape(forId)}`);
      if (
        (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement) &&
        isShown(byId)
      ) {
        return byId;
      }
    }
    const nested = label.querySelector("input, textarea");
    if (
      (nested instanceof HTMLInputElement || nested instanceof HTMLTextAreaElement) &&
      isShown(nested)
    ) {
      return nested;
    }
    let next = label.nextElementSibling;
    while (next) {
      if (
        (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) &&
        isShown(next)
      ) {
        return next;
      }
      const inner = next.querySelector("input, textarea");
      if (
        (inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement) &&
        isShown(inner)
      ) {
        return inner;
      }
      if (next.matches("label, .field__label")) break;
      next = next.nextElementSibling;
    }
    const field = label.closest(".field, .textbox, .floating-label");
    const inField = field?.querySelector("input, textarea");
    if (
      (inField instanceof HTMLInputElement || inField instanceof HTMLTextAreaElement) &&
      isShown(inField)
    ) {
      return inField;
    }
    return null;
  };

  const labeledInput = (
    dialog: HTMLElement,
    kind: "name" | "value",
  ): HTMLInputElement | HTMLTextAreaElement | null => {
    const want = kind === "name" ? /^name$/i : /^value$/i;
    const placeholder = kind === "name" ? /example:\s*year/i : /example:\s*2017/i;
    for (const label of dialog.querySelectorAll("label, .field__label, .textbox__label, legend")) {
      if (!want.test(normalize(label.textContent ?? ""))) continue;
      const input = associatedInput(dialog, label);
      if (input) return input;
    }
    const inputs = [...dialog.querySelectorAll("input[type='text'], input:not([type]), textarea")].filter(
      (el): el is HTMLInputElement | HTMLTextAreaElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && isShown(el),
    );
    for (const input of inputs) {
      if (placeholder.test(`${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`)) {
        return input;
      }
    }
    return kind === "name" ? (inputs[0] ?? null) : (inputs[1] ?? null);
  };

  const saveButton = (dialog: HTMLElement): HTMLElement | null => {
    for (const el of dialog.querySelectorAll("button, [role='button']")) {
      if (!(el instanceof HTMLElement) || !isShown(el)) continue;
      if (!/^save$/i.test(normalize(el.textContent ?? ""))) continue;
      return el;
    }
    return null;
  };

  const isDisabled = (el: HTMLElement): boolean =>
    (el instanceof HTMLButtonElement && el.disabled) ||
    el.getAttribute("aria-disabled") === "true" ||
    el.className.toLowerCase().includes("disabled");

  const closeDialog = (dialog: HTMLElement): void => {
    const closeBtn = dialog.querySelector<HTMLElement>(
      'button.lightbox-dialog__close, button[aria-label*="Close" i]',
    );
    if (closeBtn && isShown(closeBtn)) {
      fireClick(closeBtn);
      return;
    }
    for (const el of dialog.querySelectorAll("button, [role='button']")) {
      if (!(el instanceof HTMLElement) || !isShown(el)) continue;
      if (/^(close|cancel)$/i.test(normalize(el.textContent ?? ""))) {
        fireClick(el);
        return;
      }
    }
  };

  const key = normalize(payload.key);
  const value = normalize(payload.value.replace(/<[^>]+>/g, " "));
  if (!key || !value) {
    return { ok: false, reason: "Empty custom specific" };
  }

  const existing = findField(key);
  if (existing) {
    return fillFieldValue(existing, value)
      ? { ok: true, reason: "filled existing" }
      : { ok: false, reason: "Existing field would not accept value" };
  }

  const leftover = customDialog();
  if (leftover) {
    closeDialog(leftover);
    await delay(200);
  }

  let opened = false;
  const addRoot = attributeRoot();
  for (const el of addRoot.querySelectorAll("button, a, [role='button']")) {
    if (!(el instanceof HTMLElement) || !isShown(el)) continue;
    if (!/add custom item specific/i.test(normalize(el.textContent ?? ""))) continue;
    fireClick(el);
    opened = true;
    break;
  }
  if (!opened) {
    return { ok: false, reason: "Add custom item specific button not found" };
  }

  const startedOpen = Date.now();
  let dialog = customDialog();
  while (!dialog && Date.now() - startedOpen < 3000) {
    await delay(120);
    dialog = customDialog();
  }
  if (!dialog) {
    return { ok: false, reason: "Custom specific dialog did not open" };
  }

  const nameInput = labeledInput(dialog, "name");
  if (!nameInput) {
    closeDialog(dialog);
    return { ok: false, reason: "Name input missing in custom dialog" };
  }
  nameInput.focus();
  setNativeValue(nameInput, key);
  await delay(150);

  const valueWait = Date.now();
  let valueInput = labeledInput(dialog, "value");
  while (
    (!valueInput || valueInput.disabled || valueInput.getAttribute("aria-disabled") === "true") &&
    Date.now() - valueWait < 2000
  ) {
    await delay(100);
    valueInput = labeledInput(dialog, "value");
  }
  if (!valueInput) {
    closeDialog(dialog);
    return { ok: false, reason: "Value input missing in custom dialog" };
  }
  valueInput.focus();
  setNativeValue(valueInput, value);
  await delay(150);

  const saveWait = Date.now();
  let save = saveButton(dialog);
  while (save && isDisabled(save) && Date.now() - saveWait < 2000) {
    await delay(100);
    save = saveButton(dialog);
  }
  if (!save || isDisabled(save)) {
    closeDialog(dialog);
    return { ok: false, reason: "Save button not ready" };
  }
  fireClick(save);

  const started = Date.now();
  while (customDialog() && Date.now() - started < 3000) {
    await delay(120);
  }
  while (!findField(key) && Date.now() - started < 4000) {
    await delay(120);
  }

  if (!findField(key)) {
    const leftoverDialog = customDialog();
    if (leftoverDialog) closeDialog(leftoverDialog);
    return { ok: false, reason: `Custom field "${key}" did not appear` };
  }
  return { ok: true, reason: "added custom" };
}
