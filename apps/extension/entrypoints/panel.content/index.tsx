import ReactDOM from "react-dom/client";
import type { Root } from "react-dom/client";
import { SellSimilarAssistant } from "../../components/SellSimilarAssistant.tsx";
import assistantCss from "../../components/SellSimilarAssistant.css?inline";
import {
  PANEL_HOST_ATTR,
  PANEL_HOST_SELECTOR,
  PANEL_HOST_TAG,
  insertBeforeListingHeading,
  isEbayListingEditorUrl,
  listingEditorAnchorSelector,
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
  z-index: 20 !important;
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
  shadowHost.style.setProperty("z-index", "20", "important");
  shadowHost.style.setProperty("box-sizing", "border-box", "important");

  container.style.display = "block";
  container.style.width = "100%";
  container.style.position = "static";
  container.className = "assistant-root";
}

function syncHostHeight(shadowHost: HTMLElement, container: HTMLElement): void {
  const height = Math.ceil(container.getBoundingClientRect().height);
  if (height > 0) {
    shadowHost.style.setProperty("height", `${height}px`, "important");
  }
}

/**
 * FR-001: insert the assistant into the listing form, above the page title.
 */
export default defineContentScript({
  matches: ["*://*.ebay.com/*", "*://ebay.com/*"],
  runAt: "document_idle",
  cssInjectionMode: "manual",

  async main(ctx) {
    injectHostPageStyles();

    const ui = await createShadowRootUi<MountedAssistant>(ctx, {
      name: PANEL_HOST_TAG,
      position: "inline",
      inheritStyles: false,
      css: SHADOW_CSS,
      append: insertBeforeListingHeading,
      anchor: listingEditorAnchorSelector,
      isolateEvents: [
        "keyup",
        "keydown",
        "keypress",
        "click",
        "mousedown",
        "mouseup",
        "pointerdown",
        "pointerup",
      ],
      onMount(container, shadow, shadowHost) {
        applyShadowCss(shadow);
        applyInFlowHostStyles(shadowHost, container);
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

    let autoMountStarted = false;

    function pruneDuplicateHosts(): void {
      const hosts = document.querySelectorAll(PANEL_HOST_SELECTOR);
      hosts.forEach((host, index) => {
        if (index > 0) {
          host.remove();
        }
      });
    }

    function showPanel(): void {
      if (!autoMountStarted) {
        ui.autoMount();
        autoMountStarted = true;
      }
      pruneDuplicateHosts();
    }

    function hidePanel(): void {
      ui.remove();
      autoMountStarted = false;
    }

    function syncPanel(url: URL = new URL(window.location.href)): void {
      if (isEbayListingEditorUrl(url)) {
        showPanel();
        return;
      }
      hidePanel();
    }

    syncPanel();
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      syncPanel(newUrl);
    });
  },
});
