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
 * Adds a source item specific that has no matching editor field.
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
    input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
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

  const findField = (key: string): HTMLElement | null => {
    const wanted = compact(key);
    for (const node of attributeRoot().querySelectorAll('[data-testid="attribute"]')) {
      if (!(node instanceof HTMLElement)) continue;
      if (compact(fieldLabel(node)) === wanted) return node;
    }
    return null;
  };

  const findAddInput = (): HTMLInputElement | null => {
    const inputs = attributeRoot().querySelectorAll(
      "input[type='text'], input:not([type]), input.textbox__control",
    );
    for (const input of inputs) {
      if (!(input instanceof HTMLInputElement) || !isShown(input)) continue;
      const haystack = `${input.name} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
      if (
        /unused/.test(haystack) ||
        /add( an)?( your own)? item specific/.test(haystack) ||
        /search (for )?(an )?item specific/.test(haystack) ||
        /select item specific/.test(haystack) ||
        /custom item specific/.test(haystack) ||
        /select or add/.test(haystack)
      ) {
        return input;
      }
    }
    return null;
  };

  const fillFieldValue = (field: HTMLElement, value: string): boolean => {
    const named = field.querySelector(
      'input[name^="attributes."]:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), textarea[name^="attributes."]',
    );
    if (named instanceof HTMLInputElement || named instanceof HTMLTextAreaElement) {
      named.focus();
      setNativeValue(named, value);
      named.blur();
      return true;
    }
    const search = field.querySelector('input[name^="search-box-attributes"], input.textbox__control');
    if (search instanceof HTMLInputElement && isShown(search)) {
      search.focus();
      setNativeValue(search, value);
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
      );
      search.blur();
      return true;
    }
    const fallback = field.querySelector("input[type='text'], textarea");
    if (fallback instanceof HTMLInputElement || fallback instanceof HTMLTextAreaElement) {
      fallback.focus();
      setNativeValue(fallback, value);
      fallback.blur();
      return true;
    }
    return false;
  };

  const clickCreateOption = (key: string): boolean => {
    const wanted = compact(key);
    const options = [
      ...document.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], .listbox__option, .menu__item, .listbox-button__option',
      ),
    ];
    let create: HTMLElement | null = null;
    let exact: HTMLElement | null = null;
    for (const option of options) {
      if (!(option instanceof HTMLElement) || !isShown(option)) continue;
      const text = normalize(option.textContent ?? "");
      const label = text.replace(/~\s*[\d.,]+\s*[kmb]?\s*searches/gi, "").split("\n")[0] ?? "";
      const optionKey = compact(label);
      if (optionKey === wanted || (wanted.length >= 8 && optionKey.startsWith(wanted))) {
        exact = option;
      }
      if (
        /^(add|use|create)\b/i.test(text) &&
        optionKey.includes(wanted) &&
        !/add item specific$/i.test(text)
      ) {
        create = option;
      }
      if (/add custom|your own item specific|use this (text|value)/i.test(text)) {
        create = option;
      }
    }
    const pick = create ?? exact;
    if (!pick) return false;
    fireClick(pick);
    return true;
  };

  const key = normalize(payload.key);
  const value = normalize(payload.value);
  if (!key || !value) {
    return { ok: false, reason: "Empty custom specific" };
  }

  let field = findField(key);
  if (field) {
    return fillFieldValue(field, value)
      ? { ok: true, reason: "filled existing" }
      : { ok: false, reason: "Existing field would not accept value" };
  }

  const root = attributeRoot();
  for (const el of root.querySelectorAll("button, a, [role='button']")) {
    if (!(el instanceof HTMLElement) || !isShown(el)) continue;
    const text = normalize(el.textContent ?? "");
    if (/^add( your own)?( an)? item specific$/i.test(text)) {
      fireClick(el);
      await delay(200);
      break;
    }
  }

  const addInput = findAddInput();
  if (!addInput) {
    return { ok: false, reason: "Add item specific input not found" };
  }

  addInput.focus();
  setNativeValue(addInput, key);
  await delay(250);
  if (!clickCreateOption(key)) {
    addInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
    addInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    );
  }
  await delay(350);

  const started = Date.now();
  while (!findField(key) && Date.now() - started < 2000) {
    await delay(120);
  }

  field = findField(key);
  if (!field) {
    return { ok: false, reason: `Custom field "${key}" did not appear` };
  }
  if (!fillFieldValue(field, value)) {
    return { ok: false, reason: `Could not fill custom value for "${key}"` };
  }
  return { ok: true, reason: "added custom" };
}