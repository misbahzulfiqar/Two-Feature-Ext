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

export function stylePanelSlot(slot: HTMLElement, alignTo?: Element | null): void {
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

  // Sitting at shell level makes the slot full-bleed, so borrow the content
  // container's width and gutters to stay lined up with the form below.
  if (alignTo instanceof HTMLElement) {
    const styles = window.getComputedStyle(alignTo);
    if (styles.maxWidth && styles.maxWidth !== "none") {
      slot.style.setProperty("max-width", styles.maxWidth, "important");
    }
    slot.style.setProperty("margin-left", "auto", "important");
    slot.style.setProperty("margin-right", "auto", "important");
    slot.style.setProperty("padding-left", styles.paddingLeft, "important");
    slot.style.setProperty("padding-right", styles.paddingRight, "important");
  }
}

/**
 * eBay's page shell is:
 *
 *   div.root
 *   |- div.header
 *   |- div.container   <- the entire listing form lives in here
 *   `- div.footer
 *
 * The panel belongs between .header and .container, as a direct child of
 * .root. That keeps it out of the container subtree eBay re-renders, which is
 * what kept remounting the panel and re-triggering the Compatibility iframe.
 */
export function shellAnchor(): { parent: Element; before: Element } | null {
  const direct =
    document.querySelector("div.root > div.container") ??
    document.querySelector(".root > .container");
  if (direct?.parentElement) {
    return { parent: direct.parentElement, before: direct };
  }

  // Shell classes shift occasionally; fall back to any element owning both a
  // header and a container child.
  for (const root of document.querySelectorAll("div")) {
    const header = root.querySelector(":scope > .header");
    const container = root.querySelector(":scope > .container");
    if (header && container && container.parentElement === root) {
      return { parent: root, before: container };
    }
  }
  return null;
}

/**
 * Fallback for pages without that shell: below the page header but OUTSIDE
 * eBay's <form>.
 *
 * .main__container--form is a div *inside* the form element, so anchoring as
 * its sibling still lands within the form. eBay re-renders that subtree, which
 * remounts the panel and re-triggers the Compatibility iframe load over and
 * over. Walk up to the outermost <form> ancestor and sit in front of it.
 */
export function anchorOutsideForm(container: Element): { parent: Element; before: Element } | null {
  let outermostForm: Element | null = null;
  for (let node: Element | null = container; node; node = node.parentElement) {
    if (node.tagName === "FORM") {
      outermostForm = node;
    }
  }

  const target = outermostForm ?? container;
  const parent = target.parentElement;
  if (!parent) {
    return null;
  }
  return { parent, before: target };
}

/**
 * The slot is only ever inserted as a preceding sibling of `before`. It is
 * never prepended into it: that is what placed the panel inside the form.
 */
function ensurePanelSlot(parent: Element, before: Element): HTMLElement {
  const existing = parent.querySelector(`:scope > ${PANEL_SLOT_SELECTOR}`);
  if (existing instanceof HTMLElement) {
    if (existing.nextElementSibling !== before) {
      parent.insertBefore(existing, before);
    }
    return existing;
  }

  document.querySelectorAll(PANEL_SLOT_SELECTOR).forEach((node) => {
    node.remove();
  });
  const slot = document.createElement("div");
  slot.setAttribute(PANEL_SLOT_ATTR, "");
  parent.insertBefore(slot, before);
  return slot;
}

/**
 * Sit in the listing content column, immediately above the eBay form heading.
 * Staying out of the sticky header keeps the chrome clean; staying out of the
 * form's inner Helix tree avoids wiping Compatibility.
 */
export function insertBeforeListingHeading(anchor: Element, ui: Element): void {
  // Preferred: between .header and .container in eBay's page shell.
  const shell = shellAnchor();
  const spot = shell ?? anchorOutsideForm(listingPageContainer(anchor));
  if (!spot) {
    // Detached container: leave the panel where it is rather than forcing it
    // into the form, which is the failure mode this function exists to avoid.
    return;
  }

  const slot = ensurePanelSlot(spot.parent, spot.before);
  stylePanelSlot(slot, shell ? shell.before : null);
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
