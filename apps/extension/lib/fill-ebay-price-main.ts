export type FillItemPriceMainResult = {
  ok: boolean;
  price: boolean;
  reason: string;
};

/**
 * Runs in the listing page MAIN world so eBay React sees the same DOM
 * events as a real type. Do not close over module scope — Chrome
 * serializes this function into the page.
 */
export async function fillItemPriceInPage(price: string): Promise<FillItemPriceMainResult> {
  const log = (step: string, detail?: unknown): void => {
    if (detail === undefined) {
      console.log(`[SellSimilar][price] ${step}`);
      return;
    }
    console.log(`[SellSimilar][price] ${step}`, detail);
  };

  const normalize = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const toAmount = (text: string): string => {
    const match = normalize(text)
      .replace(/,/g, "")
      .match(/(\d+(?:\.\d{1,2})?)/);
    if (!match) return "";
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return "";
    return amount.toFixed(2);
  };

  const wanted = toAmount(price);
  if (!wanted) {
    return { ok: false, price: false, reason: "No price" };
  }

  const isShown = (el: HTMLElement): boolean => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  };

  const isPriceInput = (input: HTMLInputElement): boolean => {
    if (!isShown(input) || input.type === "hidden" || input.disabled) return false;
    if (input.closest(".lightbox-dialog, [role='dialog']")) return false;
    const hay = [
      input.name,
      input.id,
      input.getAttribute("aria-label") ?? "",
      input.placeholder,
      input.closest("label")?.textContent ?? "",
      input.closest(".smry, .summary__price, [inflow], [class*='price']")?.textContent?.slice(0, 80) ??
        "",
    ]
      .join(" ")
      .toLowerCase();
    if (/shipping|handling|original retail|msrp|deposit|quantity|discount|off/.test(hay)) {
      return false;
    }
    return /^(price|binprice|buynowprice|startprice|bin)$/i.test(input.name) || /\b(price|buy it now)\b/.test(hay);
  };

  const findPriceInput = (): HTMLInputElement | null => {
    const named = document.querySelectorAll(
      'input[name="price"], input[name="binPrice"], input[name="buyItNowPrice"], input[name="startPrice"]',
    );
    for (const node of named) {
      if (node instanceof HTMLInputElement && isPriceInput(node)) return node;
    }
    const section = document.querySelector(
      '.summary__price, [inflow*="price" i], .smry.summary__price',
    );
    const scoped = section?.querySelectorAll("input[type='text'], input[type='number'], input:not([type])");
    for (const node of scoped ?? []) {
      if (node instanceof HTMLInputElement && isPriceInput(node)) return node;
    }
    for (const node of document.querySelectorAll("input[type='text'], input[type='number'], input:not([type])")) {
      if (node instanceof HTMLInputElement && isPriceInput(node)) return node;
    }
    return null;
  };

  try {
    const input = findPriceInput();
    if (!input) {
      log("field not found");
      return { ok: false, price: false, reason: "Price field not found" };
    }
    input.focus();
    setNativeValue(input, wanted);
    input.blur();
    const applied = toAmount(input.value);
    const ok = applied === wanted;
    log(ok ? "updated" : "did not stick", { wanted, applied, name: input.name });
    return { ok, price: ok, reason: ok ? "updated" : "Price did not stick" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log("MAIN-world error", reason);
    return { ok: false, price: false, reason };
  }
}
