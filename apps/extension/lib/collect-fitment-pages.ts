import type { FitmentPageRow, FitmentPageSnapshot } from "./fitment-page.ts";
import { CLICK_FITMENT_NEXT, EXPAND_FITMENT, READ_FITMENT_PAGE } from "./scrape-messages.ts";

export type FitmentPageProgress = {
  page: number;
  vehicles: number;
  message: string;
};

export type CollectedFitmentPages = {
  tables: string[];
  advertised: number;
  vehicles: number;
  note?: string;
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
export async function walkFitmentPagesInListing(expectedCount = 0): Promise<PageWalkResult> {
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

  const compatibilityRoot = (): Element | null =>
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector("[data-testid='d-motors-compatibility-table']") ||
    document.querySelector("[data-testid='d-item-compatibility']") ||
    document.querySelector(".motors-compatibility-table-wrapper") ||
    document.querySelector(".comp-fitment-selector");

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

  const inPhotos = (el: Element): boolean =>
    Boolean(
      el.closest(
        ".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='carousel']",
      ),
    );

  const controlsUnder = (root: ParentNode): HTMLElement[] => {
    const found: HTMLElement[] = [];
    const visit = (node: ParentNode): void => {
      for (const el of Array.from(node.querySelectorAll("button, a, [role='button']"))) {
        if (el instanceof HTMLElement) {
          found.push(el);
        }
      }
      for (const el of Array.from(node.querySelectorAll("*"))) {
        if (el.shadowRoot) {
          visit(el.shadowRoot);
        }
      }
    };
    visit(root);
    return found;
  };

  const nextControl = (): HTMLElement | null => {
    const pools: HTMLElement[] = [];
    let node: Element | null = compatibilityRoot();
    for (let depth = 0; depth < 14 && node; depth += 1) {
      pools.push(...controlsUnder(node));
      node = node.parentElement;
    }
    if (pools.length === 0) {
      pools.push(...controlsUnder(document.body));
    }
    const current = pools.find((el) => el.getAttribute("aria-current") === "page" && !inPhotos(el));
    const wanted = String((Number.parseInt(clean(current?.textContent || ""), 10) || 1) + 1);
    const ranked = pools.filter((el) => {
      if (disabled(el) || inPhotos(el)) {
        return false;
      }
      const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
      const text = clean(el.textContent || "");
      const cls = classText(el);
      if (/next image|next photo|next slide|previous/i.test(label)) {
        return false;
      }
      return (
        /pagination__next/i.test(cls) ||
        el.getAttribute("rel") === "next" ||
        /next page|go to next/i.test(label) ||
        text === wanted
      );
    });
    return (
      ranked.find((el) => /pagination__next|next page|go to next/i.test(`${el.getAttribute("aria-label") || ""} ${classText(el)}`)) ||
      ranked[0] ||
      null
    );
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
    const next = nextControl();
    if (!next) {
      return false;
    }
    next.scrollIntoView({ block: "center" });
    next.click();
    return true;
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
    let advertised = Math.max(0, Number(expectedCount) || 0);
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
      advertised = Math.max(advertised, pageData.advertised);
      const beforeCount = all.length;
      addRows(pageData.rows);
      if (currentPage > 1 && all.length === beforeCount) {
        break;
      }
      shownPage = currentPage;
      report(currentPage, all.length, false);
      console.log("[SellSimilar][fitment-pages] page", currentPage, "vehicles", all.length, "of", advertised || "unknown");

      if (advertised > 0 && all.length >= advertised) {
        break;
      }

      let next = nextControl();
      const waitNext = Date.now();
      while (!next && advertised > all.length && Date.now() - waitNext < 10000) {
        compatibilityRoot()?.scrollIntoView({ block: "center" });
        window.scrollBy(0, 600);
        await sleep(400);
        next = nextControl();
      }
      if (!next) {
        console.log("[SellSimilar][fitment-pages] no next control", currentPage, all.length, "of", advertised);
        break;
      }

      const before = firstRowText();
      if (!clickNext()) {
        break;
      }
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
        console.log("[SellSimilar][fitment-pages] table did not change", currentPage, "retry", retryCount);
        if (retryCount < 5) {
          await sleep(1000);
          continue;
        }
        break;
      }
      retryCount = 0;
      currentPage += 1;
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

function isFitmentSnapshot(value: unknown): value is FitmentPageSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snapshot = value as FitmentPageSnapshot;
  return Array.isArray(snapshot.rows) && typeof snapshot.signature === "string";
}

async function frameIds(tabId: number): Promise<number[]> {
  const frames = await browser.webNavigation.getAllFrames({ tabId }).catch(() => null);
  const ids = frames?.map((frame) => frame.frameId) ?? [];
  return ids.length > 0 ? ids : [0];
}

async function readFitmentFrame(
  tabId: number,
): Promise<{ frameId: number; snapshot: FitmentPageSnapshot } | null> {
  let best: { frameId: number; snapshot: FitmentPageSnapshot } | null = null;
  for (const frameId of await frameIds(tabId)) {
    try {
      const value = await browser.tabs.sendMessage(tabId, { type: READ_FITMENT_PAGE }, { frameId });
      if (!isFitmentSnapshot(value)) {
        continue;
      }
      if (!best || value.rows.length > best.snapshot.rows.length) {
        best = { frameId, snapshot: value };
      }
    } catch {
      // This frame has no fitment reader yet.
    }
  }
  return best;
}

async function messageFitmentFrames(tabId: number, type: string): Promise<void> {
  for (const frameId of await frameIds(tabId)) {
    await browser.tabs.sendMessage(tabId, { type }, { frameId }).catch(() => undefined);
  }
}

async function messageFitmentFrame(
  tabId: number,
  frameId: number,
  type: string,
): Promise<{ clicked?: boolean } | null> {
  try {
    const value = await browser.tabs.sendMessage(tabId, { type }, { frameId });
    if (!value || typeof value !== "object") {
      return null;
    }
    return value as { clicked?: boolean };
  } catch {
    return null;
  }
}

async function waitForItemPage(tabId: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 25000) {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab) {
      return;
    }
    if (tab.status === "complete" && /\/itm\//i.test(tab.url || "")) {
      await sleep(800);
      return;
    }
    await sleep(300);
  }
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
    void browser.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") {
          finish();
          return;
        }
        browser.tabs.onUpdated.addListener(onUpdated);
      })
      .catch(() => {
        finish();
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

type LiveFitmentRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

export type LiveFitmentSnapshot = {
  rows: LiveFitmentRow[];
  signature: string;
  advertised: number;
  nextLabel: string;
  controls: string[];
};

/** One compatibility page. Self-contained so Chrome can inject it. */
export function readLiveFitmentSnapshot(): LiveFitmentSnapshot {
  const clean = (text: string): string =>
    String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const classText = (el: Element): string => (typeof el.className === "string" ? el.className : "");
  const disabled = (el: Element | null): boolean =>
    !el ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(classText(el));
  const inPhotos = (el: Element): boolean =>
    Boolean(el.closest(".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='carousel']"));

  const root =
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector("[data-testid='d-motors-compatibility-table']") ||
    document.querySelector("[data-testid='d-item-compatibility']") ||
    document.querySelector(".motors-compatibility-table-wrapper") ||
    document.querySelector(".comp-fitment-selector");
  root?.scrollIntoView({ block: "center" });

  const table =
    (root?.tagName === "TABLE" ? root : root?.querySelector("table")) ||
    document.querySelector(".motors-compatibility-table tbody")?.closest("table") ||
    document.querySelector("[data-testid='d-item-compatibility'] table") ||
    document.querySelector(".comp-fitment-selector table");

  const rows: LiveFitmentRow[] = [];
  const seen = new Set<string>();
  if (table) {
    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => clean(cell.textContent || ""));
      if (cells.length < 3 || !cells[0] || !cells[1] || !cells[2]) {
        continue;
      }
      const entry = {
        year: cells[0],
        make: cells[1],
        model: cells[2],
        trim: cells[3] || "",
        engine: cells[4] || "",
        notes: cells[5] || "",
      };
      const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}|${entry.engine}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push(entry);
    }
  }

  const scopes: ParentNode[] = [];
  let node: Element | null = root;
  for (let depth = 0; depth < 12 && node; depth += 1) {
    scopes.push(node);
    node = node.parentElement;
  }
  if (scopes.length === 0 && document.body) {
    scopes.push(document.body);
  }
  const controls: HTMLElement[] = [];
  for (const scope of scopes) {
    for (const el of Array.from(scope.querySelectorAll("button, a, [role='button']"))) {
      if (el instanceof HTMLElement && !inPhotos(el)) {
        controls.push(el);
      }
      if (el.shadowRoot) {
        for (const inner of Array.from(el.shadowRoot.querySelectorAll("button, a, [role='button']"))) {
          if (inner instanceof HTMLElement) {
            controls.push(inner);
          }
        }
      }
    }
  }
  const described = controls.slice(0, 25).map((el) => {
    const label = el.getAttribute("aria-label") || "";
    const text = clean(el.textContent || "").slice(0, 24);
    return `${el.tagName} label="${label}" text="${text}" class="${classText(el).slice(0, 50)}"`;
  });
  const current = controls.find((el) => el.getAttribute("aria-current") === "page");
  const wanted = String((Number.parseInt(clean(current?.textContent || ""), 10) || 1) + 1);
  const next = controls.find((el) => {
    if (disabled(el)) {
      return false;
    }
    const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
    const text = clean(el.textContent || "");
    if (/next image|next photo|next slide|previous/i.test(label)) {
      return false;
    }
    return /pagination__next/i.test(classText(el)) || /next page|go to next/i.test(label) || text === wanted;
  });
  const hay = clean(`${root?.textContent || ""}`).slice(0, 2500);
  const advertisedMatch =
    hay.match(/compatible with\s+(\d+)\s+vehicle/i) || hay.match(/(\d+)\s+vehicle\(s\)/i);
  const advertised = advertisedMatch ? Number.parseInt(advertisedMatch[1] ?? "", 10) : 0;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    rows,
    signature: first ? `${rows.length}|${first.year}|${first.make}|${first.model}|${last?.year ?? ""}|${last?.model ?? ""}` : "",
    advertised: Number.isFinite(advertised) ? advertised : 0,
    nextLabel: next ? next.getAttribute("aria-label") || clean(next.textContent || "") || classText(next) : "",
    controls: described,
  };
}

/** Clicks the compatibility Next control. Self-contained so Chrome can inject it. */
export function clickLiveFitmentNext(): boolean {
  const clean = (text: string): string => String(text || "").replace(/\s+/g, " ").trim();
  const classText = (el: Element): string => (typeof el.className === "string" ? el.className : "");
  const disabled = (el: Element | null): boolean =>
    !el ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(classText(el));
  const root =
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector("[data-testid='d-motors-compatibility-table']") ||
    document.querySelector("[data-testid='d-item-compatibility']") ||
    document.querySelector(".motors-compatibility-table-wrapper") ||
    document.querySelector(".comp-fitment-selector") ||
    document.body;
  const controls: HTMLElement[] = [];
  let node: Element | null = root;
  for (let depth = 0; depth < 12 && node; depth += 1) {
    for (const el of Array.from(node.querySelectorAll("button, a, [role='button']"))) {
      if (
        el instanceof HTMLElement &&
        !el.closest(".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='carousel']")
      ) {
        controls.push(el);
      }
    }
    node = node.parentElement;
  }
  const current = controls.find((el) => el.getAttribute("aria-current") === "page");
  const wanted = String((Number.parseInt(clean(current?.textContent || ""), 10) || 1) + 1);
  const next = controls.find((el) => {
    if (disabled(el)) {
      return false;
    }
    const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
    if (/next image|next photo|previous/i.test(label)) {
      return false;
    }
    return /pagination__next/i.test(classText(el)) || /next page|go to next/i.test(label) || clean(el.textContent || "") === wanted;
  });
  if (!next) {
    return false;
  }
  next.scrollIntoView({ block: "center" });
  next.click();
  return true;
}

function embedLiveRows(rows: LiveFitmentRow[]): string {
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
    )
    .join("");
  const json = JSON.stringify(rows).replace(/</g, "\\u003c");
  return `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${json}</script>`;
}

async function readLiveSnapshot(tabId: number): Promise<LiveFitmentSnapshot | null> {
  try {
    const injected = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readLiveFitmentSnapshot,
    });
    const value = injected[0]?.result;
    if (!value || !Array.isArray(value.rows)) {
      return null;
    }
    return value;
  } catch (error) {
    console.log(
      "[SellSimilar] fitment read failed!!!!!",
      error instanceof Error ? error.message : error,
    );
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
    await waitForItemPage(tabId);

    const all: FitmentPageRow[] = [];
    const seen = new Set<string>();
    const seenSignatures = new Set<string>();
    let advertised = Math.max(0, expectedCount);
    let note = "";
    let frameId = 0;
    const readyAt = Date.now();
    let read = await readFitmentFrame(tabId);
    while ((!read || read.snapshot.rows.length === 0) && Date.now() - readyAt < 25000) {
      await messageFitmentFrames(tabId, EXPAND_FITMENT);
      await sleep(600);
      read = await readFitmentFrame(tabId);
    }
    if (!read || read.snapshot.rows.length === 0) {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      note = `The listing tab did not show the compatibility table. ${tab?.url || ""}`.trim();
      console.log("[SellSimilar][fitment-pages]", note, read?.snapshot.controls ?? []);
      return { ...empty, note };
    }
    frameId = read.frameId;
    let snapshot = read.snapshot;

    for (let page = 1; page <= 40 && snapshot; page += 1) {
      if (!snapshot.signature || seenSignatures.has(snapshot.signature)) {
        note = `Page ${page} repeated the same vehicles.`;
        break;
      }
      seenSignatures.add(snapshot.signature);
      for (const row of snapshot.rows) {
        const key = `${row.year}|${row.make}|${row.model}|${row.trim}|${row.engine}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(row);
        }
      }
      advertised = Math.max(advertised, snapshot.advertised);
      const message = `Scraped page ${page} — ${all.length} vehicles found so far`;
      console.log("[SellSimilar][fitment-pages]", message, "next:", snapshot.nextLabel || "none", snapshot.controls.slice(0, 8));
      onProgress?.({ page, vehicles: all.length, message });
      if (advertised > 0 && all.length >= advertised) {
        note = "";
        break;
      }

      let nextLabel = snapshot.nextLabel;
      const waitNext = Date.now();
      while (!nextLabel && advertised > all.length && Date.now() - waitNext < 8000) {
        await sleep(400);
        const again = await readFitmentFrame(tabId);
        if (again && again.snapshot.rows.length > 0) {
          frameId = again.frameId;
          snapshot = again.snapshot;
        }
        nextLabel = snapshot.nextLabel;
        advertised = Math.max(advertised, snapshot.advertised);
      }
      if (!nextLabel) {
        note = `No Next control after page ${page}. Controls: ${snapshot.controls.slice(0, 6).join(" | ") || "none"}`;
        console.log("[SellSimilar][fitment-pages]", note);
        break;
      }

      const before = snapshot.signature;
      const clicked = await messageFitmentFrame(tabId, frameId, CLICK_FITMENT_NEXT);
      if (!clicked || clicked.clicked !== true) {
        note = `Next control could not be clicked on page ${page}.`;
        break;
      }
      const changedAt = Date.now();
      let moved = false;
      while (Date.now() - changedAt < 20000) {
        await sleep(350);
        const next = await readFitmentFrame(tabId);
        if (next?.snapshot.signature && next.snapshot.signature !== before) {
          frameId = next.frameId;
          snapshot = next.snapshot;
          moved = true;
          break;
        }
      }
      if (!moved) {
        note = `Page ${page + 1} did not load after clicking Next.`;
        console.log("[SellSimilar][fitment-pages]", note);
        break;
      }
    }

    if (all.length === 0) {
      return { ...empty, note: note || "No compatibility rows were read." };
    }
    return {
      tables: [embedLiveRows(all)],
      advertised,
      vehicles: all.length,
      note,
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

type FrameFitmentRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

function frameSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function frameClean(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/read more|read less|compatibility notes/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function frameClassText(el: Element): string {
  const value = el.className;
  return typeof value === "string" ? value : "";
}

function frameDisabled(el: Element | null): boolean {
  if (!el) {
    return true;
  }
  return (
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(frameClassText(el))
  );
}

function frameRoot(doc: Document): Element | null {
  return (
    doc.querySelector(".motors-compatibility-table") ||
    doc.querySelector("[data-testid='d-motors-compatibility-table']") ||
    doc.querySelector("[data-testid='d-item-compatibility']") ||
    doc.querySelector(".motors-compatibility-table-wrapper")
  );
}

function frameRows(doc: Document): FrameFitmentRow[] {
  const root = frameRoot(doc);
  const table =
    (root?.tagName === "TABLE" ? root : root?.querySelector("table")) ||
    doc.querySelector(".motors-compatibility-table tbody")?.closest("table") ||
    doc.querySelector("[data-testid='d-motors-compatibility-table'] table") ||
    doc.querySelector("[data-testid='d-item-compatibility'] table");
  if (!table) {
    return [];
  }
  const rows: FrameFitmentRow[] = [];
  const seen = new Set<string>();
  for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
    const cells = Array.from(row.querySelectorAll("td")).map((cell) => frameClean(cell.textContent || ""));
    if (cells.length < 3 || !cells[0] || !cells[1] || !cells[2]) {
      continue;
    }
    const entry = {
      year: cells[0],
      make: cells[1],
      model: cells[2],
      trim: cells[3] || "",
      engine: cells[4] || "",
      notes: cells[5] || "",
    };
    const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}|${entry.engine}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push(entry);
  }
  return rows;
}

function frameFirstRow(doc: Document): string {
  const row =
    doc.querySelector(".motors-compatibility-table tbody tr") ||
    doc.querySelector("[data-testid='d-motors-compatibility-table'] tbody tr") ||
    doc.querySelector("[data-testid='d-item-compatibility'] tbody tr");
  return row ? frameClean(row.textContent || "") : "";
}

function deepElements(root: ParentNode): Element[] {
  const found: Element[] = [];
  for (const node of Array.from(root.querySelectorAll("*"))) {
    found.push(node);
    if (node.shadowRoot) {
      found.push(...deepElements(node.shadowRoot));
    }
  }
  return found;
}

function frameSearchRoots(doc: Document): ParentNode[] {
  const roots: ParentNode[] = [];
  let node: Element | null = frameRoot(doc);
  for (let depth = 0; depth < 6 && node; depth += 1) {
    roots.push(node);
    node = node.parentElement;
  }
  if (roots.length === 0) {
    roots.push(doc.body);
  }
  return roots;
}

function inPhotoControl(el: Element): boolean {
  return Boolean(
    el.closest(
      ".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='carousel'], [class*='image-treatment']",
    ),
  );
}

function frameNextControl(doc: Document): HTMLElement | null {
  const controls: Element[] = [];
  for (const root of frameSearchRoots(doc)) {
    controls.push(...deepElements(root).filter((el) => el.matches("button, a, [role='button']")));
  }
  const current = controls.find((el) => el.getAttribute("aria-current") === "page" && !inPhotoControl(el));
  const wanted = String((Number.parseInt(frameClean(current?.textContent || ""), 10) || 1) + 1);
  const ranked = controls.filter((el) => {
    if (!(el instanceof HTMLElement) || frameDisabled(el) || inPhotoControl(el)) {
      return false;
    }
    const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
    const text = frameClean(el.textContent || "");
    const cls = frameClassText(el);
    if (/next image|next photo|next slide|previous/i.test(label)) {
      return false;
    }
    return (
      /pagination__next/i.test(cls) ||
      el.getAttribute("rel") === "next" ||
      /next page|go to next/i.test(label) ||
      text === wanted ||
      new RegExp(`^go to page ${wanted}$`, "i").test(label.trim())
    );
  });
  const nextArrow = ranked.find((el) => {
    const label = `${el.getAttribute("aria-label") || ""} ${frameClassText(el)}`;
    return /pagination__next|next page|go to next/i.test(label);
  });
  const chosen = (nextArrow || ranked[0]) ?? null;
  return chosen instanceof HTMLElement ? chosen : null;
}

function logFitmentControls(doc: Document, note: string): void {
  const root = frameRoot(doc);
  const markup = (root?.parentElement || root)?.outerHTML || "";
  const paginationAt = markup.search(/pagination|next page|go to next|aria-label="[^"]*next/i);
  const snippet =
    paginationAt >= 0
      ? markup.slice(Math.max(0, paginationAt - 180), paginationAt + 700)
      : markup.slice(Math.max(0, markup.length - 1200));
  const controls = frameSearchRoots(doc)
    .flatMap((node) => deepElements(node))
    .filter((el) => el.matches("button, a, [role='button']"))
    .slice(0, 40)
    .map((el) => {
      const label = el.getAttribute("aria-label") || "";
      const text = frameClean(el.textContent || "").slice(0, 30);
      const cls = frameClassText(el).slice(0, 70);
      return `${el.tagName} class="${cls}" label="${label}" text="${text}"${frameDisabled(el) ? " disabled" : ""}`;
    });
  console.log("[SellSimilar][fitment-pages]", note, {
    root: root ? `${root.tagName} ${frameClassText(root).slice(0, 80)}` : "none",
    rows: frameRows(doc).length,
    controls,
  });
  console.log("[SellSimilar][fitment-pages] markup", snippet);
}

function frameClickNext(doc: Document): boolean {
  const host = frameNextControl(doc);
  if (!host) {
    return false;
  }
  host.scrollIntoView({ block: "center" });
  host.click();
  return true;
}

function frameEmbed(rows: FrameFitmentRow[]): string {
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
    )
    .join("");
  const json = JSON.stringify(rows).replace(/</g, "\\u003c");
  return `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${json}</script>`;
}

/**
 * Reads compatibility pages in a hidden frame on the eBay page.
 * No extra browser tab, so the walk cannot die with "No tab with id".
 */
export async function collectFitmentPagesInFrame(
  listingUrl: string,
  onProgress?: (progress: FitmentPageProgress) => void,
  expectedCount = 0,
): Promise<CollectedFitmentPages> {
  const empty: CollectedFitmentPages = { tables: [], advertised: 0, vehicles: 0 };
  if (typeof document === "undefined") {
    return empty;
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none;";
  iframe.src = listingUrl;
  document.documentElement.appendChild(iframe);
  console.log("[SellSimilar][fitment-pages] reading hidden listing", listingUrl, "expected", expectedCount);
  try {
    await new Promise<void>((resolve) => {
      const done = (): void => {
        iframe.removeEventListener("load", done);
        resolve();
      };
      iframe.addEventListener("load", done);
      window.setTimeout(done, 20000);
    });
    const doc = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!doc || !frameWindow) {
      console.log("[SellSimilar][fitment-pages] frame blocked", iframe.src);
      return empty;
    }
    console.log("[SellSimilar][fitment-pages] frame loaded", doc.location?.href || iframe.src);

    const readyAt = Date.now();
    while (!frameRoot(doc) && Date.now() - readyAt < 20000) {
      frameWindow.scrollBy(0, 1000);
      await frameSleep(400);
    }
    frameRoot(doc)?.scrollIntoView({ block: "center" });
    if (!frameRoot(doc)) {
      console.log("[SellSimilar][fitment-pages] compatibility table not found", doc.title);
      return empty;
    }
    logFitmentControls(doc, "table ready");

    const all: FrameFitmentRow[] = [];
    const seen = new Set<string>();
    const pageLimit = expectedCount > 20 ? Math.min(40, Math.ceil(expectedCount / 20) + 1) : 40;
    let advertised = expectedCount;

    const addRows = (rows: FrameFitmentRow[]): number => {
      let added = 0;
      for (const row of rows) {
        const key = `${row.year}|${row.make}|${row.model}|${row.trim}|${row.engine}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        all.push(row);
        added += 1;
      }
      return added;
    };

    for (let page = 1; page <= pageLimit; page += 1) {
      const rows = frameRows(doc);
      const added = addRows(rows);
      if (page > 1 && added === 0) {
        break;
      }
      if (all.length === 0) {
        break;
      }
      onProgress?.({
        page,
        vehicles: all.length,
        message: `Scraped page ${page} — ${all.length} vehicles found so far`,
      });
      if (advertised > 0 && all.length >= advertised) {
        break;
      }
      const before = frameFirstRow(doc);
      let foundNext = frameNextControl(doc);
      const waitNext = Date.now();
      while (!foundNext && all.length < advertised && Date.now() - waitNext < 8000) {
        frameRoot(doc)?.scrollIntoView({ block: "center" });
        frameWindow.scrollBy(0, 700);
        await frameSleep(400);
        foundNext = frameNextControl(doc);
      }
      if (!foundNext) {
        logFitmentControls(doc, `no next control after page ${page}, vehicles ${all.length}`);
        break;
      }
      console.log(
        "[SellSimilar][fitment-pages] clicking next",
        foundNext.getAttribute("aria-label") || frameClean(foundNext.textContent || ""),
        frameClassText(foundNext).slice(0, 80),
      );
      if (!frameClickNext(doc)) {
        logFitmentControls(doc, `click missed after page ${page}`);
        break;
      }
      const changedAt = Date.now();
      let moved = false;
      while (Date.now() - changedAt < 12000) {
        await frameSleep(300);
        const now = frameFirstRow(doc);
        if (now && now !== before) {
          moved = true;
          break;
        }
      }
      if (!moved) {
        console.log("[SellSimilar][fitment-pages] next click did not change the table", page, all.length);
        logFitmentControls(doc, "table unchanged");
        break;
      }
      console.log("[SellSimilar][fitment-pages] page changed", page + 1, frameFirstRow(doc).slice(0, 80));
    }

    console.log("[SellSimilar] fitment frame collected", all.length, "of", advertised || "unknown");
    if (all.length === 0) {
      return empty;
    }
    return {
      tables: [frameEmbed(all)],
      advertised,
      vehicles: all.length,
    };
  } finally {
    iframe.remove();
  }
}
