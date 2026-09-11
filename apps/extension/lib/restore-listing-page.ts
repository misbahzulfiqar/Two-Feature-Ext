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
    el.style.removeProperty("overflow");
    el.style.removeProperty("position");
    el.style.removeProperty("height");
    el.style.removeProperty("touch-action");
    el.classList.remove("keyboard-trap--active");
    el.removeAttribute("inert");
  }

  document.querySelectorAll("#mainContent, .main__container, .main__container--form").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.removeAttribute("aria-hidden");
    node.removeAttribute("inert");
    node.style.setProperty("overflow", "auto", "important");
    node.scrollTop = 0;
  });

  document.body.style.setProperty("overflow", "auto", "important");
  document.documentElement.style.setProperty("overflow", "auto", "important");
  window.scrollTo(0, 0);
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
