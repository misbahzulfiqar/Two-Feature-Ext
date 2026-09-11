export type RestoreListingPageMainResult = {
  ok: boolean;
};

/**
 * Runs in MAIN world so leftover eBay pickers and masks actually close.
 * Do not hide listing chrome (photos, title, description editor).
 */
export function restoreListingPageInPage(): RestoreListingPageMainResult {
  const isProtected = (el: Element | null): boolean => {
    if (!(el instanceof HTMLElement)) return true;
    return Boolean(
      el.closest(
        "[data-sell-similar-assistant], .assistant, #sell-similar-root, [data-sell-similar], .summary__description, [inflow*='description' i], [inflow*='itemDescription' i], .summary__photos, [inflow*='photo' i], .ux-image-grid, .x-photos",
      ),
    );
  };

  const isMask = (el: HTMLElement): boolean => {
    const hay = `${el.className} ${el.id}`.toLowerCase();
    return /mask|keyboard-trap|scrim|backdrop/.test(hay) && !/image|photo|picture/.test(hay);
  };

  document.querySelectorAll("[aria-expanded='true']").forEach((node) => {
    if (!(node instanceof HTMLElement) || isProtected(node)) return;
    node.click();
  });

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
  );
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
  );

  document
    .querySelectorAll(
      ".lightbox-dialog__mask, .dialog__mask, .drawer__mask, .keyboard-trap, [class*='__mask'], [class*='lightbox-dialog']",
    )
    .forEach((node) => {
      if (!(node instanceof HTMLElement) || isProtected(node)) return;
      if (!isMask(node) && !node.className.toLowerCase().includes("lightbox-dialog")) return;
      if (node.matches(".lightbox-dialog, [role='dialog']") && !isMask(node)) {
        const close = node.querySelector<HTMLElement>(
          "button.lightbox-dialog__close, button[aria-label*='Close' i], button[aria-label*='close' i]",
        );
        close?.click();
        return;
      }
      node.setAttribute("hidden", "");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });

  const active = document.activeElement;
  if (active instanceof HTMLElement && !isProtected(active)) {
    active.blur();
  }

  for (const el of [document.body, document.documentElement]) {
    el.style.removeProperty("overflow");
    el.style.removeProperty("position");
    el.style.removeProperty("height");
    el.style.removeProperty("touch-action");
    el.classList.remove("keyboard-trap--active");
    el.removeAttribute("inert");
    el.removeAttribute("aria-hidden");
  }

  document.querySelectorAll("#mainContent, .main__container, .main__container--form").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.removeAttribute("aria-hidden");
    node.removeAttribute("inert");
    node.style.removeProperty("overflow");
    node.style.setProperty("overflow", "auto", "important");
    node.scrollTop = 0;
  });

  document.body.style.setProperty("overflow", "auto", "important");
  document.documentElement.style.setProperty("overflow", "auto", "important");
  window.scrollTo(0, 0);

  return { ok: true };
}
