import {
  RESTORE_LISTING_PAGE,
  type RestoreListingPageResponse,
} from "./restore-messages.ts";

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

function isProtected(el: HTMLElement): boolean {
  return Boolean(
    el.closest(
      "[data-sell-similar-assistant], .assistant, #sell-similar-root, [data-sell-similar], .summary__description, [inflow*='description' i], [inflow*='itemDescription' i], .summary__photos, [inflow*='photo' i]",
    ),
  );
}

async function restoreIsolated(): Promise<void> {
  const dialogs = document.querySelectorAll(
    '.lightbox-dialog, [role="dialog"], .drawer, .lightbox-dialog__window',
  );
  for (const dialog of dialogs) {
    if (!(dialog instanceof HTMLElement) || dialog.hasAttribute("hidden")) continue;
    if (isProtected(dialog)) continue;
    if (!isShown(dialog) && dialog.getAttribute("aria-hidden") === "true") continue;
    const close = dialog.querySelector<HTMLElement>(
      'button.lightbox-dialog__close, button[aria-label*="Close" i], button[aria-label*="close" i]',
    );
    if (close && isShown(close)) {
      close.click();
      await delay(120);
    }
  }

  document
    .querySelectorAll(".lightbox-dialog__mask, .dialog__mask, .drawer__mask, .keyboard-trap, [class*='__mask']")
    .forEach((node) => {
      if (!(node instanceof HTMLElement) || isProtected(node)) return;
      const hay = `${node.className} ${node.id}`.toLowerCase();
      if (!/mask|keyboard-trap/.test(hay)) return;
      node.setAttribute("hidden", "");
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("pointer-events", "none", "important");
    });

  const active = document.activeElement;
  if (active instanceof HTMLElement && !isProtected(active)) {
    active.blur();
  }

  for (const el of [document.body, document.documentElement]) {
    el.classList.remove("no-touch");
    el.classList.remove("keyboard-trap--active");
    el.style.removeProperty("position");
    el.style.removeProperty("overflow");
    el.style.removeProperty("overflow-y");
    el.style.removeProperty("overflow-x");
    el.style.removeProperty("height");
    el.style.removeProperty("width");
    el.style.removeProperty("margin-top");
    el.style.removeProperty("touch-action");
  }

  document.querySelectorAll("#mainContent, .main__container, .main__container--form").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.removeAttribute("aria-hidden");
    node.removeAttribute("inert");
  });

  document.body.style.setProperty("overflow", "auto", "important");
  document.documentElement.style.setProperty("overflow", "auto", "important");

  // Deliberately no window.scrollTo(0, 0) here: callers capture the scroll
  // position before filling and hand it back with restoreListingScroll(), so
  // forcing the top would bounce the page before that restore lands.
}

export async function restoreListingPage(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: RESTORE_LISTING_PAGE } satisfies {
      type: typeof RESTORE_LISTING_PAGE;
    });
  } catch {
    // MAIN-world restore is best-effort.
  }
  await restoreIsolated();
}
