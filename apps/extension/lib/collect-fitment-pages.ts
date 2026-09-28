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

type PageWalkResult = {
  htmls: string[];
  vehicles: number;
  advertised: number;
};

type PageWalkProgress = {
  page: number;
  vehicles: number;
  done: boolean;
};

/**
 * Reads every compatibility page inside the open listing.
 * Self-contained: Chrome runs this function in the page, so it cannot use outer helpers.
 * Next sits beside the table, so the search walks up from the table and ignores the photo pager.
 */
export async function walkFitmentPagesInListing(expectedCount = 0): Promise<PageWalkResult> {
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const clean = (text: string): string =>
    text
      .replace(/\u00a0/g, " ")
      .replace(/read more|read less|compatibility notes/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const classText = (el: Element): string => {
    const value = el.className;
    return typeof value === "string" ? value : "";
  };
  const disabled = (el: Element | null): boolean => {
    if (!el) {
      return true;
    }
    const host = el.closest("button, a") || el;
    return (
      host.getAttribute("aria-disabled") === "true" ||
      host.hasAttribute("disabled") ||
      /disabled|pagination__next--disabled/.test(classText(host))
    );
  };
  const inPhotoPager = (el: Element): boolean =>
    Boolean(
      el.closest(
        ".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='image-carousel'], [class*='pic-panel']",
      ),
    );

  const findTableIn = (root: ParentNode): Element | null => {
    const candidates = Array.from(
      root.querySelectorAll(
        ".motors-compatibility-table, [data-testid='d-motors-compatibility-table'], [data-testid='d-item-compatibility'], .motors-compatibility-table-wrapper, .vim.d-motors-compatibility-table",
      ),
    );
    let best: Element | null = null;
    let bestCount = 0;
    for (const candidate of candidates) {
      const table =
        candidate.tagName === "TABLE" ? candidate : candidate.querySelector("table");
      const count = table?.querySelectorAll("tbody tr").length ?? 0;
      if (count > bestCount) {
        best = table;
        bestCount = count;
      }
    }
    if (best) {
      return best;
    }
    for (const candidate of Array.from(root.querySelectorAll("table"))) {
      const text = candidate.textContent || "";
      if (/year/i.test(text) && /make/i.test(text) && candidate.querySelector("tbody tr")) {
        return candidate;
      }
    }
    return null;
  };

  const findTable = (): Element | null => findTableIn(document);

  const readRows = (
    table: Element,
  ): Array<{ year: string; make: string; model: string; trim: string; engine: string; notes: string }> => {
    const headers = Array.from(table.querySelectorAll("thead th, thead td")).map((cell) =>
      clean(cell.textContent || "").toLowerCase(),
    );
    const headerIndex = (name: string): number => headers.findIndex((header) => header.indexOf(name) >= 0);
    const rows: Array<{ year: string; make: string; model: string; trim: string; engine: string; notes: string }> = [];
    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => clean(cell.textContent || ""));
      if (cells.length < 3) {
        continue;
      }
      let yearIdx = headerIndex("year");
      if (yearIdx < 0 || !cells[yearIdx]) {
        yearIdx = cells.findIndex((cell) => /\b(?:19|20)\d{2}\b/.test(cell));
      }
      if (yearIdx < 0) {
        yearIdx = 0;
      }
      const makeIdx = headerIndex("make") >= 0 ? headerIndex("make") : yearIdx + 1;
      const modelIdx = headerIndex("model") >= 0 ? headerIndex("model") : yearIdx + 2;
      const trimIdx = headerIndex("trim") >= 0 ? headerIndex("trim") : yearIdx + 3;
      const engineIdx = headerIndex("engine") >= 0 ? headerIndex("engine") : yearIdx + 4;
      const notesIdx = headerIndex("note") >= 0 ? headerIndex("note") : yearIdx + 5;
      const year = cells[yearIdx] || "";
      const make = cells[makeIdx] || "";
      const model = cells[modelIdx] || "";
      if (!year || !make || !model || /^year$/i.test(year)) {
        continue;
      }
      rows.push({
        year,
        make,
        model,
        trim: cells[trimIdx] || "",
        engine: cells[engineIdx] || "",
        notes: cells[notesIdx] || "",
      });
    }
    return rows;
  };

  const signatureOf = (
    rows: Array<{ year: string; make: string; model: string; engine: string }>,
  ): string => {
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (!first) {
      return "";
    }
    return `${rows.length}|${first.year}|${first.make}|${first.model}|${first.engine}|${last?.year ?? ""}|${last?.model ?? ""}|${last?.engine ?? ""}`;
  };

  const embed = (
    rows: Array<{ year: string; make: string; model: string; trim: string; engine: string; notes: string }>,
  ): string => {
    const body = rows
      .map(
        (row) =>
          `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
      )
      .join("");
    const json = JSON.stringify(rows).replace(/</g, "\\u003c");
    return `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${json}</script>`;
  };

  const clickable = (el: Element): HTMLElement | null => {
    const inner = el.matches("button, a") ? null : el.querySelector("button, a");
    const host = el.matches("button, a")
      ? el
      : inner || el.closest("button, a") || el;
    if (!(host instanceof HTMLElement) || disabled(host) || inPhotoPager(host)) {
      return null;
    }
    return host;
  };

  const findNext = (table: Element): HTMLElement | null => {
    let node: Element | null = table;
    for (let depth = 0; depth < 14 && node; depth += 1) {
      const arrows = Array.from(
        node.querySelectorAll(
          ".pagination__next, [aria-label*='next page' i], [aria-label*='Go to next' i], [aria-label='Next' i], a[rel='next'], [data-testid='pagination-next']",
        ),
      );
      for (const arrow of arrows) {
        if (inPhotoPager(arrow)) {
          continue;
        }
        const target = clickable(arrow);
        if (target) {
          return target;
        }
      }
      const current = Array.from(node.querySelectorAll("[aria-current='page']")).find(
        (el) => !inPhotoPager(el),
      );
      const currentNum = Number.parseInt(clean(current?.textContent || ""), 10) || 1;
      const wanted = String(currentNum + 1);
      const pageLink = Array.from(node.querySelectorAll("a, button")).find((el) => {
        if (inPhotoPager(el)) {
          return false;
        }
        return clean(el.textContent || "") === wanted && !disabled(el);
      });
      if (pageLink instanceof HTMLElement) {
        return pageLink;
      }
      node = node.parentElement;
    }
    return null;
  };

  const press = (target: HTMLElement): void => {
    target.scrollIntoView({ block: "center" });
    if (target instanceof HTMLAnchorElement) {
      target.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
        },
        { capture: true },
      );
    }
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    target.click();
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  };

  const absoluteHref = (target: HTMLElement): string => {
    if (target instanceof HTMLAnchorElement && target.href) {
      return target.href;
    }
    const raw = target.getAttribute("href") || "";
    if (!raw || raw === "#" || raw.startsWith("javascript:")) {
      return "";
    }
    try {
      return new URL(raw, window.location.href).toString();
    } catch {
      return "";
    }
  };

  const fetchTable = async (url: string): Promise<Element | null> => {
    try {
      const response = await fetch(url, { credentials: "include", redirect: "follow", cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      return findTableIn(doc);
    } catch {
      return null;
    }
  };

  const advertisedCount = (table: Element): number => {
    let node: Element | null = table;
    let hay = "";
    for (let depth = 0; depth < 6 && node; depth += 1) {
      hay += ` ${node.textContent || ""}`;
      node = node.parentElement;
    }
    const text = clean(hay).slice(0, 4000);
    const match =
      text.match(/compatible with\s+(\d+)\s+vehicle/i) ||
      text.match(/(\d+)\s+compatible vehicle/i) ||
      text.match(/this part fits\s+(\d+)/i) ||
      text.match(/see all\s+(\d+)/i);
    return match ? Number.parseInt(match[1] ?? "", 10) || 0 : 0;
  };

  const firstRowText = (table: Element): string =>
    clean(table.querySelector("tbody tr")?.textContent || "");

  const progress = window as Window & { __sellSimilarFitmentProgress?: PageWalkProgress };
  const started = Date.now();
  let table = findTable();
  while (!table && Date.now() - started < 20000) {
    window.scrollBy(0, 900);
    await sleep(400);
    table = findTable();
  }
  if (!table) {
    progress.__sellSimilarFitmentProgress = { page: 0, vehicles: 0, done: true };
    return { htmls: [], vehicles: 0, advertised: 0 };
  }
  table.scrollIntoView({ block: "center" });

  const htmls: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  let advertised = Math.max(0, Number(expectedCount) || 0);
  const pageLimit = advertised > 20 ? Math.min(250, Math.ceil(advertised / 20) + 2) : 200;

  const remember = (rows: ReturnType<typeof readRows>, page: number): boolean => {
    const signature = signatureOf(rows);
    if (!signature || seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    htmls.push(embed(rows));
    total += rows.length;
    progress.__sellSimilarFitmentProgress = { page, vehicles: total, done: false };
    return true;
  };

  const finished = (): boolean => advertised > 0 && total >= advertised;

  for (let page = 1; page <= pageLimit && table; page += 1) {
    const rows = readRows(table);
    if (!remember(rows, page)) {
      break;
    }
    advertised = Math.max(advertised, advertisedCount(table));
    if (finished()) {
      break;
    }

    let next = findNext(table);
    const waitNext = Date.now();
    while (!next && rows.length >= 20 && Date.now() - waitNext < 6000) {
      await sleep(300);
      table = findTable() || table;
      next = findNext(table);
    }
    if (!next && !finished() && rows.length >= 20) {
      const seeAll = Array.from(document.querySelectorAll("a, button")).find((el) => {
        if (inPhotoPager(el)) {
          return false;
        }
        const text = clean(el.textContent || "");
        return /see all|show all|view all/i.test(text) && /vehicle|compat|fit/i.test(text);
      });
      if (seeAll instanceof HTMLElement && !disabled(seeAll)) {
        press(seeAll);
        await sleep(900);
        table = findTable() || table;
        next = findNext(table);
      }
    }
    if (!next) {
      break;
    }

    const before = firstRowText(table);
    const href = absoluteHref(next);
    press(next);
    const changedAt = Date.now();
    let moved = false;
    while (Date.now() - changedAt < 15000) {
      await sleep(300);
      const current = findTable();
      if (current && firstRowText(current) && firstRowText(current) !== before) {
        table = current;
        moved = true;
        break;
      }
    }
    if (moved) {
      continue;
    }

    const fetched = href ? await fetchTable(href) : null;
    if (!fetched || !firstRowText(fetched) || firstRowText(fetched) === before) {
      break;
    }

    let fetchedTable: Element | null = fetched;
    for (let fetchedPage = page + 1; fetchedPage <= pageLimit && fetchedTable; fetchedPage += 1) {
      const fetchedRows = readRows(fetchedTable);
      if (!remember(fetchedRows, fetchedPage)) {
        fetchedTable = null;
        break;
      }
      advertised = Math.max(advertised, advertisedCount(fetchedTable));
      if (finished()) {
        break;
      }
      const fetchedNext = findNext(fetchedTable);
      const fetchedHref = fetchedNext ? absoluteHref(fetchedNext) : "";
      if (!fetchedHref) {
        break;
      }
      const beforeFetched = firstRowText(fetchedTable);
      fetchedTable = await fetchTable(fetchedHref);
      if (!fetchedTable || firstRowText(fetchedTable) === beforeFetched) {
        break;
      }
    }
    break;
  }

  progress.__sellSimilarFitmentProgress = {
    page: htmls.length,
    vehicles: total,
    done: true,
  };
  return { htmls, vehicles: total, advertised };
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
    const watchUntil = Date.now() + 120000;
    while (!settled && Date.now() < watchUntil) {
      const state = await readWalkProgress(tabId);
      if (state && state.page >= 1 && state.vehicles > 0 && state.page !== lastPage) {
        lastPage = state.page;
        onProgress?.({
          page: state.page,
          vehicles: state.vehicles,
          message: `Page ${state.page} - ${state.vehicles} vehicles`,
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
        message: `Page ${finalState.page} - ${finalState.vehicles} vehicles`,
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
