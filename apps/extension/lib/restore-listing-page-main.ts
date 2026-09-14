export type RestoreListingPageMainResult = {
  ok: boolean;
};

/**
 * Runs in MAIN world so leftover eBay pickers and masks actually close.
 * Do not hide listing chrome (photos, title, description editor).
 * Do not close over module scope — Chrome serializes this function into the page.
 */
export function restoreListingPageInPage(): RestoreListingPageMainResult {
  const lockStyleProps = [
    "position",
    "overflow",
    "overflow-y",
    "overflow-x",
    "height",
    "width",
    "margin-top",
    "touch-action",
  ] as const;

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
    return /mask|keyboard-trap/.test(hay) && !/image|photo|picture/.test(hay);
  };

  const unlockPage = (el: HTMLElement): void => {
    el.classList.remove("no-touch");
    el.classList.remove("keyboard-trap--active");
    for (const prop of lockStyleProps) {
      el.style.removeProperty(prop);
    }
  };

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
  );
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
  );

  document
    .querySelectorAll(
      ".lightbox-dialog__mask, .dialog__mask, .drawer__mask, .keyboard-trap, [class*='__mask']",
    )
    .forEach((node) => {
      if (!(node instanceof HTMLElement) || isProtected(node)) return;
      if (!isMask(node)) return;
      node.setAttribute("hidden", "");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });

  const active = document.activeElement;
  if (active instanceof HTMLElement && !isProtected(active)) {
    active.blur();
  }

  unlockPage(document.body);
  unlockPage(document.documentElement);

  document.querySelectorAll("#mainContent, .main__container, .main__container--form").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.removeAttribute("aria-hidden");
    node.removeAttribute("inert");
  });

  document.body.style.setProperty("overflow", "auto", "important");
  document.documentElement.style.setProperty("overflow", "auto", "important");

  console.log("[sell-similar] restoreListingPage", {
    bodyClass: document.body.className,
    bodyOverflow: document.body.style.overflow,
    bodyPosition: document.body.style.position,
    bodyMarginTop: document.body.style.marginTop,
    htmlOverflow: document.documentElement.style.overflow,
  });

  return { ok: true };
}
