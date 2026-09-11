const TITLE_FIELD_SELECTORS = [
  '.summary__title input[name="title"]',
  'input[name="title"].textbox__control',
  'input[name="title"][id*="@TITLE"]',
  'input[name="title"]',
] as const;

function findTitleInput(root: ParentNode = document): HTMLInputElement | null {
  for (const selector of TITLE_FIELD_SELECTORS) {
    const el = root.querySelector(selector);
    if (el instanceof HTMLInputElement) {
      return el;
    }
  }
  return null;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
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
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

/** Blank the Title field. */
export function clearEbayListingTitle(): boolean {
  const input = findTitleInput();
  if (!input) {
    return false;
  }
  input.focus();
  setNativeInputValue(input, "");
  input.blur();
  return input.value === "";
}

export function fillEbayListingTitle(title: string): boolean {
  const input = findTitleInput();
  if (!input) {
    return false;
  }

  const decoder = document.createElement("textarea");
  decoder.innerHTML = title;
  const decoded = decoder.value
    .replace(/<\s*wbr\s*\/?\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const maxLength = input.maxLength > 0 ? input.maxLength : 80;
  const nextValue = decoded.slice(0, maxLength);
  input.focus();
  setNativeInputValue(input, nextValue);
  input.blur();
  return input.value === nextValue || input.value.includes(nextValue.slice(0, 20));
}
