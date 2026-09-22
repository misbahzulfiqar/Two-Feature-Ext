import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ScraperEnv } from "./env.js";
import puppeteer, { type Browser } from "puppeteer-core";

function defaultChromePath(): string | undefined {
  const candidates = [
    process.env.PROGRAMFILES &&
      join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    join(homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  return candidates.find((path): path is string => typeof path === "string" && existsSync(path));
}

function resolveChromeExecutable(env: ScraperEnv): string {
  const configured = env.CHROME_EXECUTABLE_PATH;
  if (configured) {
    return configured;
  }

  const found = defaultChromePath();
  if (found) {
    return found;
  }

  throw new Error(
    "Chrome was not found. Set CHROME_EXECUTABLE_PATH to your chrome.exe path.",
  );
}

/**
 * Chrome refuses to start as root unless its sandbox is disabled. Deployments
 * that run the worker as root therefore need these flags, but they are only
 * added in that case: everywhere else the sandbox stays on, which matters
 * because this browser loads arbitrary eBay pages.
 */
function rootSandboxArgs(): string[] {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (uid !== 0) {
    return [];
  }
  console.warn(
    "[browser] running as root; launching Chrome with --no-sandbox. Prefer a non-root user in production.",
  );
  return ["--no-sandbox", "--disable-setuid-sandbox"];
}

export async function createBrowser(env: ScraperEnv): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable(env),
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--start-maximized",
      "--window-size=1366,768",
      // Shared memory in containers/VPS images is often too small for Chrome.
      "--disable-dev-shm-usage",
      ...rootSandboxArgs(),
    ],
    defaultViewport: { width: 1366, height: 768 },
  });
}
