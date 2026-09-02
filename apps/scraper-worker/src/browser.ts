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
    ],
    defaultViewport: { width: 1366, height: 768 },
  });
}
