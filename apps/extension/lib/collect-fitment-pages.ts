export type FitmentPageProgress = {
  page: number;
  vehicles: number;
  message: string;
};

export type CollectedFitmentPages = {
  tables: string[];
  advertised: number;
  vehicles: number;
};

type FitmentRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

type PageWalkResult = {
  htmls: string[];
  vehicles: number;
  advertised: number;
};

type PageWalkProgress = {
  page: number;
  vehicles: number;
  done: boolean;
  message: string;
};

/**
 * Same Next-click walk FetchFitment.handlePagination used before the live deploy.
 * Self-contained: Chrome runs this function in the page, so it cannot use outer helpers.
 */
export async function walkFitmentPagesInListing(_expectedCount = 0): Promise<PageWalkResult> {
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const clean = (text: string): string =>
    String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/read more|read less|compatibility notes/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const classText = (el: Element): string => {
    const value = el.className;
    return typeof value === "string" ? value : "";
  };
  const disabled = (el: Element | null): boolean =>
    !el ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(classText(el));
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const host = window as Window & { __sellSimilarFitmentProgress?: PageWalkProgress };
  const report = (page: number, vehicles: number, done: boolean): void => {
    host.__sellSimilarFitmentProgress = {
      page,
      vehicles,
      done,
      message: page > 0 ? `Scraped page ${page} — ${vehicles} vehicles found so far` : "",
    };
  };

  const tableSelectors = [
    ".motors-compatibility-table",
    "[data-testid='d-motors-compatibility-table']",
    ".motors-compatibility-table-wrapper",
    "[data-testid='d-item-compatibility']",
  ];

  const compatibilityRoot = (): Element | null =>
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector("[data-testid='d-motors-compatibility-table']") ||
    document.querySelector("[data-testid='d-item-compatibility']") ||
    document.querySelector(".motors-compatibility-table-wrapper");

  const extractRows = (): { rows: FitmentRow[]; advertised: number } => {
    const root = compatibilityRoot();
    const table =
      (root?.tagName === "TABLE" ? root : root?.querySelector("table")) ||
      document.querySelector(".motors-compatibility-table tbody")?.closest("table") ||
      document.querySelector("[data-testid='d-motors-compatibility-table'] tbody")?.closest("table") ||
      document.querySelector(".motors-compatibility-table-wrapper tbody")?.closest("table") ||
      document.querySelector("[data-testid='d-item-compatibility'] tbody")?.closest("table");
    if (!table) {
      return { rows: [], advertised: 0 };
    }
    const rows: FitmentRow[] = [];
    const seen = new Set<string>();
    for (const row of Array.from(table.querySelectorAll("tbody.ux-table-section__body tr, tbody tr"))) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 3) {
        continue;
      }
      const entry = {
        year: clean(cells[0]?.textContent || ""),
        make: clean(cells[1]?.textContent || ""),
        model: clean(cells[2]?.textContent || ""),
        trim: clean(cells[3]?.textContent || ""),
        engine: clean(cells[4]?.textContent || ""),
        notes: clean(cells[5]?.textContent || ""),
      };
      if (!entry.year || !entry.make || !entry.model) {
        continue;
      }
      const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}|${entry.engine}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push(entry);
    }
    const hay = clean(`${root?.textContent || ""} ${document.body?.innerText || ""}`).slice(0, 8000);
    const advertisedMatch =
      hay.match(/compatible with\s+(\d+)\s+vehicle/i) ||
      hay.match(/(\d+)\s+vehicle\(s\)/i) ||
      hay.match(/of\s+(\d+)\s+vehicle/i);
    const advertised = advertisedMatch ? Number.parseInt(advertisedMatch[1] ?? "", 10) : 0;
    return { rows, advertised: Number.isFinite(advertised) ? advertised : 0 };
  };

  const paginationScope = (): Element => {
    const root = compatibilityRoot();
    let node: Element | null = root;
    for (let depth = 0; depth < 8 && node; depth += 1) {
      if (
        node.querySelector(
          ".pagination__next, [aria-label*='Go to next' i], [aria-label*='Next page' i], a[rel='next']",
        )
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return root || document.body;
  };

  const readState = (): { hasNext: boolean; pageLinkCount: number; advertised: number } => {
    const scope = paginationScope();
    const next =
      scope.querySelector(".pagination__next") ||
      scope.querySelector("[aria-label*='Go to next' i]") ||
      scope.querySelector("[aria-label*='Next page' i]") ||
      scope.querySelector("a[rel='next']");
    const pageNumbers = Array.from(scope.querySelectorAll("a, button"))
      .map((el) => clean(el.textContent || ""))
      .filter((text) => /^\d+$/.test(text));
    return {
      hasNext: Boolean(next) && !disabled(next),
      pageLinkCount: new Set(pageNumbers).size,
      advertised: extractRows().advertised,
    };
  };

  const firstRowText = (): string => {
    const firstRow =
      document.querySelector(".motors-compatibility-table tbody.ux-table-section__body tr") ||
      document.querySelector("[data-testid='d-motors-compatibility-table'] tbody tr") ||
      document.querySelector(".motors-compatibility-table-wrapper tbody tr") ||
      document.querySelector("[data-testid='d-item-compatibility'] tbody tr");
    return firstRow ? clean(firstRow.textContent || "") : "";
  };

  const clickNext = (): boolean => {
    const root = paginationScope();
    const next =
      root.querySelector(".pagination__next") ||
      root.querySelector("[aria-label*='Go to next' i]") ||
      root.querySelector("[aria-label*='Next page' i]") ||
      root.querySelector("a[rel='next']");
    if (next instanceof HTMLElement && !disabled(next)) {
      next.click();
      return true;
    }
    const current = root.querySelector("[aria-current='page']");
    const currentNum = Number.parseInt(clean(current?.textContent || ""), 10) || 1;
    const wanted = String(currentNum + 1);
    const pageLink = Array.from(root.querySelectorAll("a, button")).find(
      (el) => clean(el.textContent || "") === wanted,
    );
    if (pageLink instanceof HTMLElement && !disabled(pageLink)) {
      pageLink.click();
      return true;
    }
    return false;
  };

  const embed = (rows: FitmentRow[]): string => {
    const body = rows
      .map(
        (row) =>
          `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
      )
      .join("");
    const json = JSON.stringify(rows).replace(/</g, "\\u003c");
    return `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${json}</script>`;
  };

  try {
    const waitStarted = Date.now();
    while (!compatibilityRoot() && Date.now() - waitStarted < 30000) {
      window.scrollBy(0, 900);
      await sleep(400);
    }
    compatibilityRoot()?.scrollIntoView({ block: "center" });

    const all: FitmentRow[] = [];
    const seen = new Set<string>();
    let currentPage = 1;
    let retryCount = 0;
    let advertised = 0;
    let shownPage = 0;
    const addRows = (rows: FitmentRow[]): void => {
      for (const row of rows) {
        const key = `${row.year}|${row.make}|${row.model}|${row.trim}|${row.engine}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        all.push(row);
      }
    };

    while (currentPage <= 100 && retryCount < 5) {
      const pageData = extractRows();
      const state = readState();
      advertised = Math.max(advertised, pageData.advertised, state.advertised);
      addRows(pageData.rows);
      shownPage = currentPage;
      report(currentPage, all.length, false);

      const moreNumberedPages = state.pageLinkCount > currentPage;
      if (!state.hasNext && !moreNumberedPages) {
        break;
      }

      const before = firstRowText();
      if (!clickNext()) {
        break;
      }
      currentPage += 1;
      const changedAt = Date.now();
      let moved = false;
      while (Date.now() - changedAt < 30000) {
        await sleep(250);
        const now = firstRowText();
        if (now && now !== before) {
          moved = true;
          break;
        }
      }
      if (!moved) {
        retryCount += 1;
        if (retryCount < 5) {
          await sleep(3000);
          continue;
        }
        break;
      }
      retryCount = 0;
      await sleep(250);
    }

    if (all.length === 0) {
      report(0, 0, true);
      return { htmls: [], vehicles: 0, advertised };
    }
    report(shownPage || 1, all.length, true);
    return { htmls: [embed(all)], vehicles: all.length, advertised };
  } catch (error) {
    console.log("[SellSimilar] fitment walk error", error instanceof Error ? error.message : error);
    report(0, 0, true);
    return { htmls: [], vehicles: 0, advertised: 0 };
  }
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

async function readWalkProgress(tabId: number): Promise<PageWalkProgress | null> {
  try {
    const injected = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const state = (window as Window & { __sellSimilarFitmentProgress?: PageWalkProgress })
          .__sellSimilarFitmentProgress;
        return state ?? null;
      },
    });
    const value = injected[0]?.result;
    if (!value || typeof value.page !== "number" || typeof value.vehicles !== "number") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function pageMessage(state: PageWalkProgress): string {
  return state.message || `Scraped page ${state.page} — ${state.vehicles} vehicles found so far`;
}

/** Opens the source listing and clicks through every compatibility page. */
export async function openListingAndCollectFitment(
  listingUrl: string,
  onProgress?: (progress: FitmentPageProgress) => void,
  expectedCount = 0,
): Promise<CollectedFitmentPages> {
  const empty: CollectedFitmentPages = { tables: [], advertised: 0, vehicles: 0 };
  let tabId: number | undefined;
  try {
    const tab = await browser.tabs.create({ url: listingUrl, active: true });
    tabId = tab.id;
    if (tabId == null) {
      return empty;
    }
    await waitForTabComplete(tabId);
    await sleep(800);

    let settled = false;
    const walk = browser.scripting
      .executeScript({
        target: { tabId },
        world: "MAIN",
        func: walkFitmentPagesInListing,
        args: [expectedCount],
      })
      .finally(() => {
        settled = true;
      });

    let lastPage = 0;
    const watchUntil = Date.now() + 180000;
    while (!settled && Date.now() < watchUntil) {
      const state = await readWalkProgress(tabId);
      if (state && state.page >= 1 && state.vehicles > 0 && state.page !== lastPage) {
        lastPage = state.page;
        onProgress?.({
          page: state.page,
          vehicles: state.vehicles,
          message: pageMessage(state),
        });
      }
      await sleep(400);
    }

    const injected = await walk;
    const finalState = await readWalkProgress(tabId);
    if (finalState && finalState.page >= 1 && finalState.vehicles > 0 && finalState.page !== lastPage) {
      onProgress?.({
        page: finalState.page,
        vehicles: finalState.vehicles,
        message: pageMessage(finalState),
      });
    }
    const result = injected[0]?.result;
    const tables = Array.isArray(result?.htmls) ? result.htmls : [];
    return {
      tables,
      advertised: Number(result?.advertised) || 0,
      vehicles: Number(result?.vehicles) || 0,
    };
  } catch (error) {
    console.log(
      "[SellSimilar] fitment page walk failed",
      error instanceof Error ? error.message : error,
    );
    return empty;
  } finally {
    if (tabId != null) {
      await browser.tabs.remove(tabId).catch(() => undefined);
    }
  }
}
