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
  findListingEditorContainer,
  insertBeforeListingHeading,
  isEbayListingEditorUrl,
} from "../../lib/ebay-listing-editor.ts";
import panelCss from "./panel.css?inline";

const HOST_PAGE_STYLE_ID = "sell-similar-assistant-host-styles";
const SHADOW_CSS = `${panelCss}\n${assistantCss}`;

type MountedAssistant = {
  root: Root;
  heightSync: ResizeObserver;
};

function injectHostPageStyles(): void {
  if (document.getElementById(HOST_PAGE_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = HOST_PAGE_STYLE_ID;
  style.textContent = `${PANEL_HOST_SELECTOR} {
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
}`;
  (document.head ?? document.documentElement).append(style);
}

function applyShadowCss(shadow: ShadowRoot): void {
  if (shadow.querySelector("style[data-sell-similar-css]")) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-sell-similar-css", "");
  style.textContent = SHADOW_CSS;
  shadow.append(style);
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

    let didMount = false;
    let persistQueued = false;

    function showPanel(): void {
      const container = findListingEditorContainer();
      if (!container) {
        return;
      }
      try {
        if (!didMount) {
          ui.mount();
          didMount = true;
          insertBeforeListingHeading(container, ui.shadowHost);
          return;
        }
        if (!ui.shadowHost.isConnected) {
          insertBeforeListingHeading(container, ui.shadowHost);
        }
      } catch (error) {
        didMount = false;
        console.warn("Sell Similar: failed to mount assistant", error);
      }
    }

    function hidePanel(): void {
      ui.remove();
      didMount = false;
    }

    function syncPanel(url: URL = new URL(window.location.href)): void {
      if (isEbayListingEditorUrl(url)) {
        showPanel();
        return;
      }
      hidePanel();
    }

    function queuePlace(): void {
      if (persistQueued) {
        return;
      }
      persistQueued = true;
      requestAnimationFrame(() => {
        persistQueued = false;
        if (!ui.shadowHost.isConnected && isEbayListingEditorUrl(window.location.href)) {
          showPanel();
        }
      });
    }

    syncPanel();
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      syncPanel(newUrl);
    });

    const persist = new MutationObserver(() => {
      if (!ui.shadowHost.isConnected) {
        queuePlace();
      }
    });
    const editorRoot = findListingEditorContainer()?.parentElement ?? document.body;
    persist.observe(editorRoot, { childList: true, subtree: false });
    ctx.setInterval(() => {
      if (!ui.shadowHost.isConnected && isEbayListingEditorUrl(window.location.href)) {
        showPanel();
      }
    }, 2000);
    ctx.onInvalidated(() => {
      persist.disconnect();
    });
  },
});
