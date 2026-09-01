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
  "div.container:has(#mainContent)",
  "div.container:has(#widgets-placeholder)",
  "#mainContent",
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
  if (anchor instanceof HTMLElement && anchor.id === "mainContent") {
    return anchor.closest(".container") ?? anchor;
  }
  return anchor;
}

/**
 * Insert the assistant as the previous sibling of eBay's `.container`
 * (the one that wraps `#widgets-placeholder` and `#mainContent`).
 */
export function insertBeforeListingHeading(anchor: Element, ui: Element): void {
  const container = listingPageContainer(anchor);
  const parent = container.parentElement;
  if (parent === null) {
    return;
  }
  parent.insertBefore(ui, container);
}

export function isEbayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "ebay.com" || host.endsWith(".ebay.com");
}

export function isEbayItemListingPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === "/itm" || path.startsWith("/itm/");
}

export function isEbayListingEditorUrl(url: URL | string): boolean {
  const parsed = toUrl(url);
  if (!parsed || !isEbayHost(parsed.hostname)) {
    return false;
  }
  if (isEbayItemListingPath(parsed.pathname)) {
    return false;
  }

  const path = parsed.pathname.toLowerCase();
  if (path === "/lstng" || path.startsWith("/lstng/")) {
    return true;
  }
  if (path === "/lst" || path.startsWith("/lst/")) {
    return true;
  }
  if (path === "/sl" || path.startsWith("/sl/")) {
    return true;
  }
  if (parsed.searchParams.has("draftId") || parsed.searchParams.has("draft_id")) {
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
