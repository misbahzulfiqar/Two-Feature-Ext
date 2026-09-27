export type FitmentPageSnapshot = {
  html: string;
  rows: number;
  signature: string;
  hasNext: boolean;
  advertised: number;
};

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

const MAX_FITMENT_PAGES = 40;

/**
 * One compatibility page on the open listing. Self-contained so it can be injected.
 * The next control sits under the table, not inside it.
 */
export function readFitmentPageInListing(): FitmentPageSnapshot | null {
  const candidates = Array.from(
    document.querySelectorAll(
      ".motors-compatibility-table, [data-testid='d-motors-compatibility-table'] table, [data-testid='d-item-compatibility'] table, .motors-compatibility-table-wrapper table",
    ),
  );
  let table: Element | null = null;
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = candidate.querySelectorAll("tbody tr").length;
    if (count > bestCount) {
      table = candidate;
      bestCount = count;
    }
  }
  if (!table) {
    for (const candidate of Array.from(document.querySelectorAll("table"))) {
      const text = candidate.textContent || "";
      if (/year/i.test(text) && /make/i.test(text) && candidate.querySelector("tbody tr")) {
        table = candidate;
        break;
      }
    }
  }
  if (!table) {
    return null;
  }
  table.scrollIntoView({ block: "center" });

  const clean = (text: string): string =>
    text
      .replace(/\u00a0/g, " ")
      .replace(/read more|read less|compatibility notes/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const escapeCell = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const headers = Array.from(table.querySelectorAll("thead th, thead td")).map((cell) =>
    clean(cell.textContent || "").toLowerCase(),
  );
  const headerIndex = (name: string): number => headers.findIndex((header) => header.indexOf(name) >= 0);
  const parsedRows: Array<{
    year: string;
    make: string;
    model: string;
    trim: string;
    engine: string;
    notes: string;
  }> = [];
  for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
    const cells = Array.from(row.querySelectorAll("td")).map((cell) => clean(cell.textContent || ""));
    if (cells.length < 3) {
      continue;
    }
    let yearIdx = headerIndex("year");
    if (yearIdx < 0 || !/\b(?:19|20)\d{2}\b/.test(cells[yearIdx] || "")) {
      yearIdx = cells.findIndex((cell) => /\b(?:19|20)\d{2}\b/.test(cell));
    }
    if (yearIdx < 0) {
      continue;
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
    parsedRows.push({
      year,
      make,
      model,
      trim: cells[trimIdx] || "",
      engine: cells[engineIdx] || "",
      notes: cells[notesIdx] || "",
    });
  }
  const rows = parsedRows;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const signature = first
    ? `${rows.length}|${first.year}|${first.make}|${first.model}|${first.trim}|${first.engine}|${last?.year ?? ""}|${last?.make ?? ""}|${last?.model ?? ""}|${last?.engine ?? ""}`
    : "";
  if (!signature) {
    return null;
  }

  const disabled = (el: Element | null): boolean => {
    if (!el) {
      return true;
    }
    const host = el.closest("button, a") || el;
    const className = typeof host.className === "string" ? host.className : "";
    return (
      host.getAttribute("aria-disabled") === "true" ||
      host.hasAttribute("disabled") ||
      /(?:^|\s)disabled(?:\s|$)|pagination__next--disabled|--disabled/.test(className)
    );
  };
  const fitted =
    table.closest("[data-testid='d-item-compatibility']") ||
    table.closest("[data-testid='d-motors-compatibility-table']") ||
    table.closest(".motors-compatibility-table-wrapper") ||
    table.parentElement ||
    table;
  const scope = fitted.parentElement && fitted.parentElement !== document.body ? fitted.parentElement : fitted;
  const tableBottom = table.getBoundingClientRect().bottom;
  const controls = Array.from(scope.querySelectorAll("button, a")).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const top = el.getBoundingClientRect().top;
    return top >= tableBottom - 80 && top < tableBottom + 700;
  });
  const next = controls.find((el) => {
    const label = el.getAttribute("aria-label") || "";
    return (
      el.classList.contains("pagination__next") ||
      el.getAttribute("rel") === "next" ||
      /next page|go to next|next compatibility/i.test(label)
    );
  });
  const current = controls.find((el) => el.getAttribute("aria-current") === "page");
  const currentNum = Number.parseInt(clean(current?.textContent || ""), 10) || 1;
  const pageLink = controls.find((el) => clean(el.textContent || "") === String(currentNum + 1));
  const section =
    table.closest("[data-testid='d-motors-compatibility-table']") ||
    table.closest("[data-testid='d-item-compatibility']") ||
    table.parentElement?.parentElement ||
    table.parentElement;
  const hay = clean(`${section?.textContent || ""} ${table.parentElement?.textContent || ""}`).slice(0, 2500);
  const advertisedMatch =
    hay.match(/compatible with\s+(\d+)\s+vehicle/i) ||
    hay.match(/(\d+)\s+vehicle(?:\(s\))?/i) ||
    hay.match(/of\s+(\d+)\s+vehicle/i);
  const advertised = advertisedMatch ? Number.parseInt(advertisedMatch[1] ?? "", 10) : 0;
  const ofMatch = hay.match(/\b(\d+)\s+of\s+(\d+)\b/i);
  const moreNumbered = Boolean(ofMatch) && Number(ofMatch?.[1]) < Number(ofMatch?.[2]);
  const tableHtml = `<div class="motors-compatibility-table"><table class="motors-compatibility-table"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Trim</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td>${escapeCell(row.year)}</td><td>${escapeCell(row.make)}</td><td>${escapeCell(row.model)}</td><td>${escapeCell(row.trim)}</td><td>${escapeCell(row.engine)}</td><td>${escapeCell(row.notes)}</td></tr>`,
    )
    .join("")}</tbody></table></div><script type="application/json" id="sell-similar-fitment-page">${JSON.stringify(rows).replace(/</g, "\\u003c")}</script>`;

  return {
    html: tableHtml,
    rows: rows.length,
    signature,
    advertised: Number.isFinite(advertised) ? advertised : 0,
    hasNext: (next != null && !disabled(next)) || (pageLink != null && !disabled(pageLink)) || moreNumbered,
  };
}

/** Clicks the compatibility pager under the table. Self-contained so it can be injected. */
export function clickFitmentNextInListing(attempt?: number): boolean {
  const candidates = Array.from(
    document.querySelectorAll(
      ".motors-compatibility-table, [data-testid='d-motors-compatibility-table'] table, [data-testid='d-item-compatibility'] table, .motors-compatibility-table-wrapper table",
    ),
  );
  let table: Element | null = null;
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = candidate.querySelectorAll("tbody tr").length;
    if (count > bestCount) {
      table = candidate;
      bestCount = count;
    }
  }
  if (!table) {
    for (const candidate of Array.from(document.querySelectorAll("table"))) {
      const text = candidate.textContent || "";
      if (/year/i.test(text) && /make/i.test(text) && candidate.querySelector("tbody tr")) {
        table = candidate;
        break;
      }
    }
  }
  if (!table) {
    return false;
  }
  table.scrollIntoView({ block: "center" });

  const disabled = (el: Element | null): boolean => {
    if (!el) {
      return true;
    }
    const host = el.closest("button, a") || el;
    const className = typeof host.className === "string" ? host.className : "";
    return (
      host.getAttribute("aria-disabled") === "true" ||
      host.hasAttribute("disabled") ||
      /pagination__next--disabled|(?:^|\s)disabled(?:\s|$)/.test(className)
    );
  };
  const press = (el: HTMLElement): void => {
    const host = el.closest("button, a");
    const node = host instanceof HTMLElement ? host : el;
    node.scrollIntoView({ block: "center" });
    node.click();
  };

  const fitted =
    table.closest("[data-testid='d-item-compatibility']") ||
    table.closest("[data-testid='d-motors-compatibility-table']") ||
    table.closest(".motors-compatibility-table-wrapper") ||
    table.parentElement ||
    table;
  const scope = fitted.parentElement && fitted.parentElement !== document.body ? fitted.parentElement : fitted;
  const tableBottom = table.getBoundingClientRect().bottom;
  const controls = Array.from(scope.querySelectorAll("button, a")).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const top = el.getBoundingClientRect().top;
    return top >= tableBottom - 80 && top < tableBottom + 700;
  });
  const next = controls.find((el) => {
    const label = el.getAttribute("aria-label") || "";
    return (
      el.classList.contains("pagination__next") ||
      el.getAttribute("rel") === "next" ||
      /next page|go to next|next compatibility/i.test(label)
    );
  });
  const current = controls.find((el) => el.getAttribute("aria-current") === "page");
  const currentNum = Number.parseInt((current?.textContent || "").replace(/\s+/g, " ").trim(), 10) || 1;
  const pageLink = controls.find(
    (el) => (el.textContent || "").replace(/\s+/g, " ").trim() === String(currentNum + 1),
  );
  const preferPageNumber = (attempt ?? 1) > 1;
  if (!preferPageNumber && next && !disabled(next)) {
    press(next);
    return true;
  }
  if (pageLink && !disabled(pageLink)) {
    press(pageLink);
    return true;
  }
  if (next && !disabled(next)) {
    press(next);
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
  if (!value || typeof value.html !== "string" || typeof value.signature !== "string") {
    return null;
  }
  return value;
}

async function advanceFitmentPage(
  tabId: number,
  before: string,
): Promise<FitmentPageSnapshot | null> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const clicked = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: clickFitmentNextInListing,
      args: [attempt],
    });
    if (!clicked[0]?.result) {
      await sleep(600);
      continue;
    }
    const waitStarted = Date.now();
    while (Date.now() - waitStarted < 12000) {
      await sleep(350);
      try {
        const reading = await readSnapshot(tabId);
        if (reading && reading.signature && reading.signature !== before) {
          return reading;
        }
      } catch {
        // The listing may be navigating to the next compatibility page.
      }
    }
  }
  return null;
}

/** Opens the source listing and clicks through every compatibility page. */
export async function openListingAndCollectFitment(
  listingUrl: string,
  onProgress?: (progress: FitmentPageProgress) => void,
  expectedCount = 0,
): Promise<CollectedFitmentPages> {
  const empty: CollectedFitmentPages = { tables: [], advertised: 0, vehicles: 0 };
  const tab = await browser.tabs.create({ url: listingUrl, active: true });
  const tabId = tab.id;
  if (tabId == null) {
    return empty;
  }
  try {
    onProgress?.({
      page: 0,
      vehicles: 0,
      message: "Opening the source listing to read every compatibility page...",
    });
    await waitForTabComplete(tabId);
    const tables: string[] = [];
    const seen = new Set<string>();
    let totalVehicles = 0;
    let advertised = 0;
    const readyAt = Date.now();
    let snapshot = await readSnapshot(tabId);
    while (!snapshot && Date.now() - readyAt < 25000) {
      await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const known =
            document.querySelector("[data-testid='d-motors-compatibility-table']") ||
            document.querySelector(".motors-compatibility-table") ||
            document.querySelector("[data-testid='d-item-compatibility']");
          if (known) {
            known.scrollIntoView({ block: "center" });
            return;
          }
          window.scrollBy(0, 1000);
        },
      });
      await sleep(400);
      snapshot = await readSnapshot(tabId);
    }

    if (snapshot && snapshot.rows >= 20 && !snapshot.hasNext) {
      await browser.tabs.update(tabId, { active: true });
      await sleep(800);
      snapshot = (await readSnapshot(tabId)) ?? snapshot;
    }

    for (let page = 1; page <= MAX_FITMENT_PAGES && snapshot; page += 1) {
      if (!snapshot.signature || seen.has(snapshot.signature)) {
        break;
      }
      seen.add(snapshot.signature);
      tables.push(snapshot.html);
      totalVehicles += snapshot.rows;
      advertised = Math.max(advertised, snapshot.advertised);
      const targetCount = Math.max(advertised, expectedCount, snapshot.advertised);
      onProgress?.({
        page,
        vehicles: totalVehicles,
        message:
          targetCount > totalVehicles
            ? `Reading page ${page}, ${totalVehicles} of ${targetCount} vehicles`
            : `Reading page ${page}, ${totalVehicles} vehicles`,
      });

      if (!snapshot.hasNext && snapshot.rows >= 20 && advertised <= totalVehicles) {
        const waitNext = Date.now();
        while (!snapshot.hasNext && Date.now() - waitNext < 6000) {
          await sleep(400);
          const again = await readSnapshot(tabId);
          if (again?.hasNext || (again && again.advertised > totalVehicles)) {
            snapshot = again;
            advertised = Math.max(advertised, again.advertised);
            break;
          }
        }
      }

      const target = Math.max(advertised, expectedCount);
      const needMore = snapshot.hasNext || (target > 0 && totalVehicles < target);
      if (!needMore) {
        break;
      }

      const before = snapshot.signature;
      const next = await advanceFitmentPage(tabId, before);
      if (!next || next.signature === before) {
        break;
      }
      snapshot = next;
    }

    onProgress?.({
      page: tables.length,
      vehicles: totalVehicles,
      message:
        tables.length === 0
          ? "No compatibility table found on the source listing."
          : `Read ${tables.length} compatibility page${tables.length === 1 ? "" : "s"}, ${totalVehicles} vehicles.`,
    });
    return { tables, advertised, vehicles: totalVehicles };
  } finally {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
}
