import type { ScraperEnv } from "./env.js";
import puppeteer, { type Browser } from "puppeteer-core";

export async function createBrowser(env: ScraperEnv): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    executablePath: env.CHROME_EXECUTABLE_PATH,
  });
}
