export type FitmentPageSnapshot = {
  html: string;
  rows: number;
  signature: string;
  hasNext: boolean;
};

export type FitmentPageProgress = {
  page: number;
  vehicles: number;
};

const MAX_FITMENT_PAGES = 40;

/**
 * One compatibility page on the open listing. Self-contained so it can be injected.
 * The next control is often outside the table, so the scope walks up to the pager.
 */
export function readFitmentPageInListing(): FitmentPageSnapshot | null {
  const table =
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector('[data-testid="d-motors-compatibility-table"] table') ||
    document.querySelector('[data-testid="d-item-compatibility"] table') ||
    document.querySelector(".motors-compatibility-table-wrapper table");
  if (!table) {
    return null;
  }

  let scope: Element = table;
  let parent = table.parentElement;
  for (let depth = 0; depth < 8 && parent; depth += 1) {
    if (
      parent.querySelector(
        ".pagination__next, [aria-label*='Next' i], [aria-label*='next page' i], a[rel='next']",
      )
    ) {
      scope = parent;
      break;
    }
    parent = parent.parentElement;
  }

  const rows = Array.from(table.querySelectorAll("tbody tr")).filter((row) =>
    /\b(?:19|20)\d{2}\b/.test(row.textContent || ""),
  );
  const signature = (rows[0]?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const next =
    scope.querySelector(".pagination__next") ||
    scope.querySelector('[aria-label*="Go to next" i]') ||
    scope.querySelector('[aria-label*="Next page" i]') ||
    scope.querySelector('a[rel="next"]');
  const disabled =
    !next ||
    next.getAttribute("aria-disabled") === "true" ||
    next.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(next.className || "");

  return {
    html: table.outerHTML,
    rows: rows.length,
    signature,
    hasNext: Boolean(next) && !disabled,
  };
}

/** Clicks the compatibility pager. Self-contained so it can be injected. */
export function clickFitmentNextInListing(): boolean {
  const table =
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector('[data-testid="d-motors-compatibility-table"] table') ||
    document.querySelector('[data-testid="d-item-compatibility"] table') ||
    document.querySelector(".motors-compatibility-table-wrapper table");
  if (!table) {
    return false;
  }

  let scope: Element = table;
  let parent = table.parentElement;
  for (let depth = 0; depth < 8 && parent; depth += 1) {
    if (
      parent.querySelector(
        ".pagination__next, [aria-label*='Next' i], [aria-label*='next page' i], a[rel='next']",
      )
    ) {
      scope = parent;
      break;
    }
    parent = parent.parentElement;
  }

  const disabled = (el: Element | null): boolean =>
    !el ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(el.className || "");

  const next =
    scope.querySelector(".pagination__next") ||
    scope.querySelector('[aria-label*="Go to next" i]') ||
    scope.querySelector('[aria-label*="Next page" i]') ||
    scope.querySelector('a[rel="next"]');
  if (next instanceof HTMLElement && !disabled(next)) {
    next.click();
    return true;
  }

  const current = scope.querySelector('[aria-current="page"]');
  const currentNum = Number.parseInt((current?.textContent || "").trim(), 10) || 1;
  const wanted = String(currentNum + 1);
  const pageLink = Array.from(scope.querySelectorAll("a, button")).find(
    (el) => (el.textContent || "").trim() === wanted,
  );
  if (pageLink instanceof HTMLElement && !disabled(pageLink)) {
    pageLink.click();
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function readSnapshot(tabId: number): Promise<FitmentPageSnapshot | null> {
  const injected = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: readFitmentPageInListing,
  });
  const value = injected[0]?.result;
  if (!value || typeof value.html !== "string") {
    return null;
  }
  return value;
}

/** Opens the source listing and clicks through every compatibility page. */
export async function openListingAndCollectFitment(
  listingUrl: string,
  onProgress?: (progress: FitmentPageProgress) => void,
): Promise<string[]> {
  const tab = await browser.tabs.create({ url: listingUrl, active: false });
  const tabId = tab.id;
  if (tabId == null) {
    return [];
  }
  try {
    await waitForTabComplete(tabId);
    const tables: string[] = [];
    const seen = new Set<string>();
    let totalVehicles = 0;
    const readyAt = Date.now();
    let snapshot = await readSnapshot(tabId);
    while (!snapshot && Date.now() - readyAt < 12000) {
      await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          window.scrollBy(0, 900);
        },
      });
      await sleep(400);
      snapshot = await readSnapshot(tabId);
    }

    for (let page = 1; page <= MAX_FITMENT_PAGES && snapshot; page += 1) {
      if (!snapshot.signature || seen.has(snapshot.signature)) {
        break;
      }
      seen.add(snapshot.signature);
      tables.push(snapshot.html);
      totalVehicles += snapshot.rows;
      onProgress?.({ page, vehicles: totalVehicles });
      if (!snapshot.hasNext) {
        break;
      }
      const before = snapshot.signature;
      const clicked = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: clickFitmentNextInListing,
      });
      if (!clicked[0]?.result) {
        break;
      }
      const waitStarted = Date.now();
      let next = snapshot;
      while (Date.now() - waitStarted < 8000) {
        await sleep(300);
        const reading = await readSnapshot(tabId);
        if (reading && reading.signature && reading.signature !== before) {
          next = reading;
          break;
        }
      }
      if (!next || next.signature === before) {
        break;
      }
      snapshot = next;
    }
    return tables;
  } finally {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
}
