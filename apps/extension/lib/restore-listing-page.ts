function isShown(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type ListingScrollPosition = {
  x: number;
  y: number;
};

/** Where the page is scrolled right now, so it can be handed back later. */
export function captureListingScroll(): ListingScrollPosition {
  return { x: window.scrollX, y: window.scrollY };
}

/**
 * Put the page back where the user left it. Driving eBay's dialogs requires
 * scrollIntoView, which otherwise strands them next to whichever widget was
 * filled last.
 */
export function restoreListingScroll(position: ListingScrollPosition): void {
  window.scrollTo({ left: position.x, top: position.y, behavior: "auto" });
}

export async function restoreListingPage(): Promise<void> {
  const dialogs = document.querySelectorAll(
    '.lightbox-dialog, [role="dialog"], .drawer, .lightbox-dialog__window',
  );
  for (const dialog of dialogs) {
    if (!(dialog instanceof HTMLElement) || dialog.hasAttribute("hidden")) continue;
    if (!isShown(dialog) && dialog.getAttribute("aria-hidden") === "true") continue;
    const close = dialog.querySelector<HTMLElement>(
      'button.lightbox-dialog__close, button[aria-label*="Close" i], button[aria-label*="close" i]',
    );
    if (close && isShown(close)) {
      close.click();
      await delay(120);
    }
  }

  document.querySelectorAll(".lightbox-dialog__mask, .dialog__mask, .drawer__mask, .keyboard-trap").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.setAttribute("hidden", "");
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("pointer-events", "none", "important");
  });

  for (const el of [document.body, document.documentElement]) {
    el.style.removeProperty("overflow");
    el.style.removeProperty("position");
    el.style.removeProperty("height");
    el.style.removeProperty("touch-action");
    el.classList.remove("keyboard-trap--active");
    el.removeAttribute("inert");
  }

  document.querySelectorAll("#mainContent, .main__container, .main__container--form, [aria-hidden='true']").forEach(
    (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.closest(".lightbox-dialog, [role='dialog']")) return;
      if (node === document.body || node.id === "mainContent" || node.className.includes("main__")) {
        node.removeAttribute("aria-hidden");
        node.removeAttribute("inert");
      }
    },
  );

  document.body.style.setProperty("overflow", "auto", "important");
  document.documentElement.style.setProperty("overflow", "auto", "important");
}
