/**
 * FR-001: show the in-page panel only on the eBay listing editor
 * (create, draft, revise, sell similar). Never on /itm/... or other sites.
 */
const EDITOR_MODES = new Set([
  "additem",
  "relist",
  "revise",
  "reviseitem",
  "salesimilar",
]);

export const PANEL_HOST_TAG = "div";
export const PANEL_HOST_ATTR = "data-sell-similar-assistant";
export const PANEL_HOST_SELECTOR = `[${PANEL_HOST_ATTR}]`;
export const PANEL_SLOT_ATTR = "data-sell-similar-slot";
export const PANEL_SLOT_SELECTOR = `[${PANEL_SLOT_ATTR}]`;

/** eBay listing chrome: header, then this container, then the form. */
export const LISTING_EDITOR_INSERT_SELECTORS = [
  ".main__container--form",
  ".main__container",
  "div.container:has(#mainContent)",
  "div.container:has(#widgets-placeholder)",
  "#mainContent",
  ".summary__container",
] as const;

export function listingEditorAnchorSelector(): string {
  for (const selector of LISTING_EDITOR_INSERT_SELECTORS) {
    if (document.querySelector(selector)) {
      return selector;
    }
  }
  return LISTING_EDITOR_INSERT_SELECTORS.join(", ");
}

function listingPageContainer(anchor: Element): Element {
  if (!(anchor instanceof HTMLElement)) {
    return anchor;
  }
  const form = anchor.closest(".main__container--form");
  if (form) {
    return form;
  }
  if (anchor.classList.contains("main__container")) {
    const inner = anchor.querySelector(".main__container--form");
    if (inner) {
      return inner;
    }
  }
  if (anchor.id === "mainContent") {
    return anchor.closest(".container") ?? anchor;
  }
  return anchor;
}

export function findListingEditorContainer(): Element | undefined {
  for (const selector of LISTING_EDITOR_INSERT_SELECTORS) {
    const match = document.querySelector(selector);
    if (match) {
      return listingPageContainer(match);
    }
  }
  return undefined;
}

export function stylePanelSlot(slot: HTMLElement): void {
  slot.style.setProperty("display", "block", "important");
  slot.style.setProperty("position", "static", "important");
  slot.style.setProperty("top", "auto", "important");
  slot.style.setProperty("z-index", "auto", "important");
  slot.style.setProperty("width", "100%", "important");
  slot.style.setProperty("max-width", "100%", "important");
  slot.style.setProperty("box-sizing", "border-box", "important");
  slot.style.setProperty("float", "none", "important");
  slot.style.setProperty("clear", "both", "important");
  slot.style.setProperty("margin", "0", "important");
  slot.style.setProperty("padding", "8px 0 12px", "important");
  slot.style.setProperty("background", "transparent", "important");
  slot.style.setProperty("border", "0", "important");
  slot.style.setProperty("box-shadow", "none", "important");
}

function ensurePanelSlot(parent: Element, form: Element): HTMLElement {
  const hostParent = parent === form ? form : parent;
  const existing = hostParent.querySelector(`:scope > ${PANEL_SLOT_SELECTOR}`);
  if (existing instanceof HTMLElement) {
    if (hostParent === form) {
      if (form.firstElementChild !== existing) {
        form.prepend(existing);
      }
    } else if (existing.nextElementSibling !== form) {
      parent.insertBefore(existing, form);
    }
    return existing;
  }
  document.querySelectorAll(PANEL_SLOT_SELECTOR).forEach((node) => {
    node.remove();
  });
  const slot = document.createElement("div");
  slot.setAttribute(PANEL_SLOT_ATTR, "");
  if (hostParent === form) {
    form.prepend(slot);
  } else {
    parent.insertBefore(slot, form);
  }
  return slot;
}

/**
 * Sit in the listing content column, immediately above the eBay form heading.
 * Staying out of the sticky header keeps the chrome clean; staying out of the
 * form's inner Helix tree avoids wiping Compatibility.
 */
export function insertBeforeListingHeading(anchor: Element, ui: Element): void {
  const form = listingPageContainer(anchor);
  const parent = form.parentElement ?? form;
  const slot = ensurePanelSlot(parent, form);
  stylePanelSlot(slot);
  if (ui.parentElement !== slot) {
    slot.append(ui);
  }
}

export function isEbayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "ebay.com" || host.endsWith(".ebay.com");
}

export function isEbayItemListingPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === "/itm" || path.startsWith("/itm/");
}

export function isEbayPrelistPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === "/sl/prelist" || path.startsWith("/sl/prelist");
}

export function isEbayListingEditorUrl(url: URL | string): boolean {
  const parsed = toUrl(url);
  if (!parsed || !isEbayHost(parsed.hostname)) {
    return false;
  }
  if (isEbayItemListingPath(parsed.pathname) || isEbayPrelistPath(parsed.pathname)) {
    return false;
  }

  const path = parsed.pathname.toLowerCase();
  if (path === "/listing" || path.startsWith("/listing/")) {
    return true;
  }
  if (path === "/lstng" || path.startsWith("/lstng/")) {
    return true;
  }
  if (path === "/lst" || path.startsWith("/lst/")) {
    return true;
  }
  if (path === "/sl" || path.startsWith("/sl/")) {
    return true;
  }
  if (
    parsed.searchParams.has("draftId") ||
    parsed.searchParams.has("draftid") ||
    parsed.searchParams.has("draft_id")
  ) {
    return true;
  }

  const mode = parsed.searchParams.get("mode")?.toLowerCase();
  return mode !== undefined && EDITOR_MODES.has(mode);
}

function toUrl(url: URL | string): URL | undefined {
  if (url instanceof URL) {
    return url;
  }
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
