import ReactDOM from "react-dom/client";
import type { Root } from "react-dom/client";
import { SellSimilarAssistant } from "../../components/SellSimilarAssistant.tsx";
import assistantCss from "../../components/SellSimilarAssistant.css?inline";
import {
  EBAY_CONTENT_SCRIPT_EXCLUDE_MATCHES,
  EBAY_LISTING_EDITOR_MATCHES,
} from "../../lib/content-script-matches.ts";
import {
  PANEL_HOST_ATTR,
  PANEL_HOST_SELECTOR,
  PANEL_HOST_TAG,
  PANEL_SLOT_SELECTOR,
  findListingEditorContainer,
  insertBeforeListingHeading,
  isEbayListingEditorUrl,
} from "../../lib/ebay-listing-editor.ts";
import panelCss from "./panel.css?inline";

const HOST_PAGE_STYLE_ID = "sell-similar-assistant-host-styles";
const SHADOW_CSS = `${panelCss}\n${assistantCss}`;

function hideEbayHelpControl(): void {
  const isOverflowControl = (el: HTMLElement): boolean => {
    const hay = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return (
      /overflow|more options|more actions|^more$|open menu/i.test(hay) ||
      text === "..." ||
      text === "⋯" ||
      text === "•••"
    );
  };

  const isHelpControl = (el: HTMLElement): boolean => {
    if (el.closest(PANEL_HOST_SELECTOR) || el.closest(PANEL_SLOT_SELECTOR)) {
      return false;
    }
    if (el.closest(".smry, .summary--fitments, .fitment-wrapper, [data-testid='fitment-frame']")) {
      return false;
    }
    if (isOverflowControl(el)) {
      return false;
    }
    const aria = (el.getAttribute("aria-label") ?? "").trim();
    const title = (el.getAttribute("title") ?? "").trim();
    const testid = (el.getAttribute("data-testid") ?? "").trim();
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (/^(help|\?|get help|listing help)$/i.test(aria)) return true;
    if (/\bhelp\b/i.test(aria)) return true;
    if (/^(help|\?)$/i.test(title)) return true;
    if (/help/i.test(testid)) return true;
    if (text === "?" || text === "？") return true;
    return false;
  };

  const hide = (el: HTMLElement): void => {
    el.setAttribute("hidden", "");
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
  };

  for (const el of document.querySelectorAll("button, a, [role='button']")) {
    if (el instanceof HTMLElement && isHelpControl(el)) {
      hide(el);
    }
  }
}

type MountedAssistant = {
  root: Root;
  heightSync: ResizeObserver;
};

function injectHostPageStyles(): void {
  let style = document.getElementById(HOST_PAGE_STYLE_ID);
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.id = HOST_PAGE_STYLE_ID;
    (document.head ?? document.documentElement).append(style);
  }
  style.textContent = `${PANEL_SLOT_SELECTOR} {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  position: static !important;
  top: auto !important;
  float: none !important;
  clear: both !important;
  flex: 0 0 auto !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 8px 0 12px !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  z-index: auto !important;
}
${PANEL_HOST_SELECTOR} {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  position: static !important;
  float: none !important;
  clear: both !important;
  flex: 0 0 auto !important;
  align-self: stretch !important;
  grid-area: auto !important;
  inset: auto !important;
  transform: none !important;
  z-index: 40 !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
`;
}

function applyShadowCss(shadow: ShadowRoot): void {
  let style = shadow.querySelector("style[data-sell-similar-css]");
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.setAttribute("data-sell-similar-css", "");
    shadow.append(style);
  }
  style.textContent = SHADOW_CSS;
}

function applyInFlowHostStyles(shadowHost: HTMLElement, container: HTMLElement): void {
  shadowHost.setAttribute(PANEL_HOST_ATTR, "");
  shadowHost.style.setProperty("display", "block", "important");
  shadowHost.style.setProperty("width", "100%", "important");
  shadowHost.style.setProperty("max-width", "100%", "important");
  shadowHost.style.setProperty("position", "static", "important");
  shadowHost.style.setProperty("float", "none", "important");
  shadowHost.style.setProperty("clear", "both", "important");
  shadowHost.style.setProperty("flex", "0 0 auto", "important");
  shadowHost.style.setProperty("inset", "auto", "important");
  shadowHost.style.setProperty("transform", "none", "important");
  shadowHost.style.setProperty("overflow", "visible", "important");
  shadowHost.style.setProperty("z-index", "40", "important");
  shadowHost.style.setProperty("box-sizing", "border-box", "important");

  container.style.display = "block";
  container.style.width = "100%";
  container.style.position = "static";
  container.className = "assistant-root";
}

function syncHostHeight(shadowHost: HTMLElement, container: HTMLElement): void {
  const height = Math.ceil(container.scrollHeight || container.getBoundingClientRect().height);
  if (height > 0) {
    shadowHost.style.setProperty("min-height", `${height}px`, "important");
    shadowHost.style.setProperty("height", "auto", "important");
  }
}

/**
 * FR-001: insert the assistant into the listing form, above the page title.
 */
export default defineContentScript({
  matches: [...EBAY_LISTING_EDITOR_MATCHES],
  excludeMatches: [...EBAY_CONTENT_SCRIPT_EXCLUDE_MATCHES],
  runAt: "document_idle",
  allFrames: false,
  cssInjectionMode: "manual",

  async main(ctx) {
    document.querySelectorAll(PANEL_HOST_SELECTOR).forEach((host) => {
      host.remove();
    });

    injectHostPageStyles();

    const ui = await createShadowRootUi<MountedAssistant>(ctx, {
      name: PANEL_HOST_TAG,
      position: "inline",
      inheritStyles: true,
      css: SHADOW_CSS,
      append: insertBeforeListingHeading,
      anchor: () => findListingEditorContainer(),
      isolateEvents: ["keyup", "keydown", "keypress"],
      onMount(container, shadow, shadowHost) {
        applyShadowCss(shadow);
        applyInFlowHostStyles(shadowHost, container);
        shadowHost.style.setProperty("min-height", "140px", "important");
        const root = ReactDOM.createRoot(container);
        root.render(<SellSimilarAssistant />);
        syncHostHeight(shadowHost, container);

        const heightSync = new ResizeObserver(() => {
          syncHostHeight(shadowHost, container);
        });
        heightSync.observe(container);
        requestAnimationFrame(() => {
          syncHostHeight(shadowHost, container);
        });

        return { root, heightSync };
      },
      onRemove(mounted) {
        mounted?.heightSync.disconnect();
        mounted?.root.unmount();
      },
    });

    const REATTACH_MS = 400;
    let didMount = false;
    let waitObserver: MutationObserver | null = null;
    let keepAliveObserver: MutationObserver | null = null;
    let reattachTimer: number | null = null;

    function stopWaitingForEditor(): void {
      waitObserver?.disconnect();
      waitObserver = null;
    }

    function stopKeepAlive(): void {
      keepAliveObserver?.disconnect();
      keepAliveObserver = null;
      if (reattachTimer != null) {
        window.clearTimeout(reattachTimer);
        reattachTimer = null;
      }
    }

    function panelAnchor(): Element | undefined {
      return findListingEditorContainer();
    }

    /**
     * Mount React once. If Helix later detaches the host, put the same node
     * back after a short pause — do not remount, and do not poll every 2s.
     */
    function attachPanel(): void {
      const anchor = panelAnchor();
      if (!anchor) {
        return;
      }
      try {
        if (!didMount) {
          ui.mount();
          didMount = true;
        }
        if (!ui.shadowHost.isConnected) {
          insertBeforeListingHeading(anchor, ui.shadowHost);
        }
        hideEbayHelpControl();
        requestAnimationFrame(() => {
          hideEbayHelpControl();
        });
        stopWaitingForEditor();
        startKeepAlive();
      } catch (error) {
        didMount = false;
        console.warn("Sell Similar: failed to mount assistant", error);
      }
    }

    function scheduleReattach(): void {
      if (!didMount || ui.shadowHost.isConnected) {
        return;
      }
      if (!isEbayListingEditorUrl(window.location.href) || reattachTimer != null) {
        return;
      }
      reattachTimer = window.setTimeout(() => {
        reattachTimer = null;
        if (!didMount || ui.shadowHost.isConnected) {
          return;
        }
        if (!isEbayListingEditorUrl(window.location.href)) {
          return;
        }
        attachPanel();
      }, REATTACH_MS);
    }

    function startKeepAlive(): void {
      if (keepAliveObserver || !document.body) {
        return;
      }
      keepAliveObserver = new MutationObserver(() => {
        if (didMount && !ui.shadowHost.isConnected) {
          scheduleReattach();
        }
      });
      keepAliveObserver.observe(document.body, { childList: true, subtree: true });
    }

    function waitForEditorThenMount(): void {
      attachPanel();
      if (didMount || waitObserver) {
        return;
      }
      waitObserver = new MutationObserver(() => {
        attachPanel();
      });
      waitObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    function hidePanel(): void {
      stopWaitingForEditor();
      stopKeepAlive();
      ui.remove();
      didMount = false;
    }

    function syncPanel(url: URL = new URL(window.location.href)): void {
      if (isEbayListingEditorUrl(url)) {
        waitForEditorThenMount();
        return;
      }
      hidePanel();
    }

    syncPanel();
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      syncPanel(newUrl);
    });
    ctx.onInvalidated(() => {
      stopWaitingForEditor();
      stopKeepAlive();
    });
  },
});
