import { parseHTML } from "linkedom";

type ParsedPage = ReturnType<typeof parseHTML>;

/**
 * Runs the existing listing extractors against HTML the extension already
 * captured. Vercel has no Chrome, and downloading Chromium fails with
 * "fetch failed", so this page stands in for Puppeteer when the HTML is here.
 */
export function createSnapshotPage(html: string, listingUrl: string) {
  let parsed = parseHTML(html);
  applyDomPolyfills(parsed);

  return {
    snapshotOnly: true as const,
    url() {
      return listingUrl;
    },
    async setContent(nextHtml: string) {
      parsed = parseHTML(nextHtml);
      applyDomPolyfills(parsed);
    },
    async goto() {
      throw new Error("Live browser is not available for this scrape");
    },
    async waitForSelector(selector: string) {
      const found = parsed.document.querySelector(selector);
      if (!found) {
        throw new Error(`Waiting for selector ${selector} failed`);
      }
      return found;
    },
    async waitForFunction(fn: unknown, _options?: unknown, ...args: unknown[]) {
      const ok = await this.evaluate(fn, ...args);
      if (!ok) {
        throw new Error("waitForFunction timed out");
      }
      return ok;
    },
    async evaluate(fn: unknown, ...args: unknown[]) {
      return withDocumentGlobals(parsed, () => {
        if (typeof fn === "string") {
          return new Function(`return (${fn});`)();
        }
        if (typeof fn === "function") {
          return fn(...args);
        }
        throw new Error("Unsupported page.evaluate call");
      });
    },
  };
}

function applyDomPolyfills(parsed: ParsedPage): void {
  const proto = parsed.window.HTMLElement?.prototype;
  if (!proto) {
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(proto, "innerText")) {
    Object.defineProperty(proto, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? "";
      },
    });
  }
  if (typeof proto.click !== "function") {
    proto.click = function click() {};
  }
}

function withDocumentGlobals<T>(parsed: ParsedPage, run: () => T): T {
  const keys = ["document", "window", "DOMParser", "HTMLElement", "Node"] as const;
  const previous = new Map<string, unknown>();
  const values: Record<(typeof keys)[number], unknown> = {
    document: parsed.document,
    window: parsed.window,
    DOMParser: parsed.window.DOMParser,
    HTMLElement: parsed.window.HTMLElement,
    Node: parsed.window.Node,
  };
  for (const key of keys) {
    previous.set(key, Reflect.get(globalThis, key));
    Reflect.set(globalThis, key, values[key]);
  }
  try {
    return run();
  } finally {
    for (const key of keys) {
      Reflect.set(globalThis, key, previous.get(key));
    }
  }
}
