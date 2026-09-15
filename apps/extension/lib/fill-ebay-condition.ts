import {
  FILL_ITEM_CONDITION,
  type FillItemConditionResponse,
} from "./condition-messages.ts";

export type FillConditionResult = {
  condition: boolean;
  conditionDescription: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalize(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string): string {
  return normalize(text).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function conditionKey(text: string): string {
  return compact(text).replace(/seedetails/g, "");
}

function collapseRepeated(text: string): string {
  const n = normalize(text);
  const key = compact(n);
  if (key.length >= 4 && key.length % 2 === 0 && key.slice(0, key.length / 2) === key.slice(key.length / 2)) {
    return collapseRepeated(n.slice(0, Math.max(1, Math.floor(n.length / 2))));
  }
  return n;
}

function canonicalCondition(raw: string): string {
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
}

function isEbayStandardConditionBlurb(text: string): boolean {
  const compactText = compact(text);
  if (!compactText) return true;
  if (compactText.includes("seethesellerslistingforfulldetails")) return true;
  if (compactText.includes("abrandnewunusedunopenedundamaged")) return true;
  if (compactText.includes("initsoriginalpackagingwherepackagingisapplicable")) return true;
  if (compactText.includes("anitemthathasbeenusedpreviously")) return true;
  return false;
}

function labelsMatch(left: string, right: string): boolean {
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
}

function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
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
}

function conditionSection(): HTMLElement | null {
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
}

function currentCondition(): string {
  const section = conditionSection();
  if (!section) return "";
  const button = section.querySelector<HTMLElement>(
    'button[name="condition"], button[aria-label*="Item condition" i], button.listbox-button__control, button.value, a.fake-link',
  );
  const valueEl = button?.querySelector<HTMLElement>(".btn__text, .listbox-button__value, .filter-button__text");
  const fromValue = normalize(valueEl?.innerText || valueEl?.textContent || "").split("\n")[0] ?? "";
  if (fromValue && !/^(select|choose|edit|item condition|condition)$/i.test(fromValue)) {
    return fromValue;
  }
  const fromControl = normalize(button?.innerText || button?.textContent || "").split("\n")[0] ?? "";
  if (fromControl && !/^(select|choose|edit|item condition|condition)$/i.test(fromControl)) {
    return fromControl;
  }
  return "";
}

function descriptionInput(): HTMLTextAreaElement | HTMLInputElement | null {
  const section = conditionSection() ?? document;
  const named = section.querySelector(
    'textarea[name*="conditionDescription" i], textarea[name*="condition" i], textarea[aria-label*="Condition description" i]',
  );
  if (named instanceof HTMLTextAreaElement || named instanceof HTMLInputElement) {
    return named;
  }
  for (const label of section.querySelectorAll("label, .textual-display, span, h3, h4")) {
    if (!/^condition description$/i.test(normalize(label.textContent ?? ""))) continue;
    const root = label.closest("div, fieldset, section") ?? section;
    const input = root.querySelector("textarea, input[type='text']");
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      return input;
    }
  }
  return null;
}

function currentDescription(): string {
  return normalize(descriptionInput()?.value ?? "");
}

function visibleConditionDialogs(): HTMLElement[] {
  return [...document.querySelectorAll('.lightbox-dialog, [role="dialog"], .drawer')].filter(
    (node): node is HTMLElement => {
      if (!(node instanceof HTMLElement) || !isShown(node) || node.hasAttribute("hidden")) {
        return false;
      }
      const text = normalize(node.innerText ?? "").slice(0, 800).toLowerCase();
      return (
        /item condition|new other|condition description/.test(text) &&
        !/first category|search for a category/.test(text)
      );
    },
  );
}

async function dismissLeftoverConditionDialogs(): Promise<void> {
  for (const dialog of visibleConditionDialogs()) {
    const done = [...dialog.querySelectorAll("button")].find((btn) => {
      const text = normalize(btn.textContent ?? "");
      return isShown(btn) && /^(done|continue|save|apply|update)$/i.test(text);
    });
    if (done) {
      done.click();
      await delay(300);
      continue;
    }
    const close = dialog.querySelector<HTMLElement>(
      'button.lightbox-dialog__close, button[aria-label*="Close" i]',
    );
    close?.click();
    await delay(300);
  }
}

async function applyConditionAndDescription(
  wantedCondition: string,
  wantedDescription: string,
): Promise<{ condition: boolean; conditionDescription: boolean }> {
  console.log("[SellSimilar][condition] requesting MAIN-world fill", {
    wantedCondition,
    wantedDescription,
  });
  try {
    const response = (await browser.runtime.sendMessage({
      type: FILL_ITEM_CONDITION,
      condition: wantedCondition,
      conditionDescription: wantedDescription,
    })) as FillItemConditionResponse | undefined;
    console.log("[SellSimilar][condition] MAIN result", response);
    await dismissLeftoverConditionDialogs();
    let descriptionOk = Boolean(response?.conditionDescription);
    if (wantedDescription && !descriptionOk) {
      descriptionOk = applyConditionDescription(wantedDescription);
    }
    return {
      condition: Boolean(response?.condition),
      conditionDescription: wantedDescription ? descriptionOk : false,
    };
  } catch (error) {
    console.error("[SellSimilar][condition] MAIN fill failed", error);
    await dismissLeftoverConditionDialogs();
    return {
      condition: false,
      conditionDescription: wantedDescription ? applyConditionDescription(wantedDescription) : false,
    };
  }
}

function applyConditionDescription(wanted: string): boolean {
  if (!wanted) return false;
  const input = descriptionInput();
  if (!input) {
    console.log("[SellSimilar][condition] description field not found");
    return false;
  }
  const maxLength = input.maxLength > 0 ? input.maxLength : 1000;
  const next = wanted.slice(0, maxLength);
  input.focus();
  setNativeValue(input, next);
  input.blur();
  const current = compact(currentDescription());
  const expected = compact(next);
  return current === expected || current.includes(expected) || expected.includes(current);
}

/**
 * Re-apply only the condition description. Filling item specifics can wipe it,
 * but restoring it writes straight to the textarea - it never opens the
 * condition modal, so this is safe to call as a follow-up pass.
 */
export function ensureConditionDescription(conditionDescription: string): boolean {
  const wanted = isEbayStandardConditionBlurb(conditionDescription)
    ? ""
    : normalize(conditionDescription).replace(/^["']+|["']+$/g, "");
  if (!wanted) {
    return false;
  }
  const current = compact(currentDescription());
  const expected = compact(wanted);
  if (current && (current === expected || current.includes(expected))) {
    return true;
  }
  return applyConditionDescription(wanted);
}

export async function fillEbayListingCondition(
  condition: string,
  conditionDescription: string,
): Promise<FillConditionResult> {
  const wantedCondition = canonicalCondition(condition);
  const wantedDescription = isEbayStandardConditionBlurb(conditionDescription)
    ? ""
    : normalize(conditionDescription).replace(/^["']+|["']+$/g, "");
  console.log("[SellSimilar][condition] start", {
    condition: wantedCondition,
    conditionDescription: wantedDescription,
    currentCondition: currentCondition(),
    currentDescription: currentDescription(),
  });

  const result: FillConditionResult = {
    condition: false,
    conditionDescription: false,
  };

  if (!wantedCondition && !wantedDescription) {
    console.log("[SellSimilar][condition] nothing to fill");
    return result;
  }

  if (wantedCondition || wantedDescription) {
    // Opening the picker is the only thing that shows a modal. If the listing
    // is already on the wanted condition there is nothing to pick, so skip it
    // and just write the description.
    const chooserShowing = (() => {
      const section = conditionSection();
      if (!section) return false;
      const labels = [...section.querySelectorAll("button, [role='button'], .filter-button")].map(
        (el) => normalize(el.textContent ?? "").split("\n")[0] ?? "",
      );
      return labels.some((label) => /^new$/i.test(label)) && labels.some((label) => /^used$/i.test(label));
    })();
    const conditionAlreadySet =
      Boolean(wantedCondition) &&
      !chooserShowing &&
      labelsMatch(currentCondition(), wantedCondition);

    if (conditionAlreadySet) {
      console.log("[SellSimilar][condition] already set; not opening the picker");
      result.condition = true;
      result.conditionDescription = wantedDescription
        ? applyConditionDescription(wantedDescription)
        : false;
    } else {
      const applied = await applyConditionAndDescription(wantedCondition, wantedDescription);
      result.condition = applied.condition;
      result.conditionDescription = applied.conditionDescription;
    }
  }
  await dismissLeftoverConditionDialogs();
  if (wantedDescription && !result.conditionDescription) {
    result.conditionDescription = applyConditionDescription(wantedDescription);
  }

  console.log("[SellSimilar][condition] result", {
    ...result,
    currentCondition: currentCondition(),
    currentDescription: currentDescription(),
  });
  return result;
}
