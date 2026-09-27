/**
 * Reads every compatibility page on an already-open eBay listing.
 * Same next-button walk the worker uses in handlePagination. Runs inside the page.
 */
export async function collectFitmentPageTables(): Promise<string[]> {
  const maxFitmentPages = 40;
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const tableSelectors = [
    ".motors-compatibility-table",
    '[data-testid="d-motors-compatibility-table"]',
    '[data-testid="d-item-compatibility"]',
    ".motors-compatibility-table-wrapper",
  ];

  const rootOf = (): Element | null => {
    for (const selector of tableSelectors) {
      const found = document.querySelector(selector);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const firstRowText = (): string => {
    const root = rootOf();
    const row =
      root?.querySelector("tbody tr") ||
      document.querySelector(".motors-compatibility-table tbody tr") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"] tbody tr') ||
      document.querySelector(".motors-compatibility-table-wrapper tbody tr") ||
      document.querySelector('[data-testid="d-item-compatibility"] tbody tr');
    return (row?.textContent || root?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
  };

  const clickNext = (): boolean => {
    const root = rootOf();
    if (!root) {
      return false;
    }
    const disabled = (el: Element | null): boolean =>
      !el ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("disabled") ||
      /disabled|pagination__next--disabled/i.test(el.className || "");

    const next =
      root.querySelector(".pagination__next") ||
      root.querySelector('[aria-label*="Go to next" i]') ||
      root.querySelector('[aria-label*="Next page" i]') ||
      root.querySelector('a[rel="next"]');
    if (next instanceof HTMLElement && !disabled(next)) {
      next.click();
      return true;
    }

    const current = root.querySelector('[aria-current="page"]');
    const currentNum = Number.parseInt((current?.textContent || "").trim(), 10) || 1;
    const wanted = String(currentNum + 1);
    const pageLink = Array.from(root.querySelectorAll("a, button")).find(
      (el) => (el.textContent || "").trim() === wanted,
    );
    if (pageLink instanceof HTMLElement && !disabled(pageLink)) {
      pageLink.click();
      return true;
    }
    return false;
  };

  const started = Date.now();
  let root = rootOf();
  while (!root && Date.now() - started < 12000) {
    window.scrollBy(0, 800);
    await sleep(400);
    root = rootOf();
  }
  if (!root) {
    return [];
  }
  root.scrollIntoView({ block: "center" });

  const tables: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= maxFitmentPages; page += 1) {
    const table = rootOf();
    const signature = firstRowText();
    if (!table || !signature || seen.has(signature)) {
      break;
    }
    seen.add(signature);
    tables.push(table.outerHTML);
    const before = signature;
    if (!clickNext()) {
      break;
    }
    const waitStarted = Date.now();
    while (Date.now() - waitStarted < 8000) {
      const nextText = firstRowText();
      if (nextText && nextText !== before) {
        break;
      }
      await sleep(250);
    }
    if (firstRowText() === before) {
      break;
    }
  }
  return tables;
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const timeout = setTimeout(finish, 20000);
    const onUpdated = (updatedId: number, info: { status?: string }): void => {
      if (updatedId === tabId && info.status === "complete") {
        finish();
      }
    };
    void browser.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        finish();
        return;
      }
      browser.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

/** Opens the source listing and clicks through every compatibility page. */
export async function openListingAndCollectFitment(listingUrl: string): Promise<string[]> {
  const tab = await browser.tabs.create({ url: listingUrl, active: false });
  const tabId = tab.id;
  if (tabId == null) {
    return [];
  }
  try {
    await waitForTabComplete(tabId);
    const injected = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: collectFitmentPageTables,
    });
    const tables = injected[0]?.result;
    return Array.isArray(tables) ? tables.filter((table) => typeof table === "string") : [];
  } finally {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
}
