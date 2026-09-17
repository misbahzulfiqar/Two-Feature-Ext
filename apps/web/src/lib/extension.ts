import { configuredExtensionId } from "./chrome-store";

export type ExtensionPing = {
  installed: true;
  extensionName: string;
  version: string;
};

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage: (
    extensionId: string,
    message: unknown,
    responseCallback: (response: unknown) => void,
  ) => void;
};

function chromeRuntime(): ChromeRuntime | undefined {
  const candidate = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  return candidate;
}

export function checkExtensionInstalled(): Promise<ExtensionPing | null> {
  const extensionId = configuredExtensionId();
  const runtime = chromeRuntime();
  if (!extensionId || !runtime) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 1500);

    try {
      runtime.sendMessage(extensionId, { type: "EBAY_SELL_SIMILAR_PING" }, (response) => {
        window.clearTimeout(timer);
        if (settled) {
          return;
        }
        settled = true;
        if (runtime.lastError) {
          resolve(null);
          return;
        }
        if (
          response &&
          typeof response === "object" &&
          "installed" in response &&
          response.installed === true &&
          "version" in response &&
          typeof response.version === "string"
        ) {
          resolve(response as ExtensionPing);
          return;
        }
        resolve(null);
      });
    } catch {
      window.clearTimeout(timer);
      settled = true;
      resolve(null);
    }
  });
}

export function pairExtension(token: string): Promise<boolean> {
  const extensionId = configuredExtensionId();
  const runtime = chromeRuntime();
  if (!extensionId || !runtime) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    runtime.sendMessage(
      extensionId,
      { type: "EBAY_SELL_SIMILAR_PAIR", token },
      (response) => {
        if (runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(
          Boolean(
            response &&
              typeof response === "object" &&
              "ok" in response &&
              response.ok === true,
          ),
        );
      },
    );
  });
}
