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

/**
 * Insert the assistant above the listing form so it stays visible.
 */
export function insertBeforeListingHeading(anchor: Element, ui: Element): void {
  const form = listingPageContainer(anchor);
  const parent = form.parentElement;
  if (parent === null) {
    if (ui.parentElement !== form) {
      form.prepend(ui);
    }
    return;
  }
  if (ui.parentElement === parent && ui.nextElementSibling === form) {
    return;
  }
  parent.insertBefore(ui, form);
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
