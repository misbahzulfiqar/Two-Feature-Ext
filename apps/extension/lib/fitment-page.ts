export type FitmentPageRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

export type FitmentPageSnapshot = {
  rows: FitmentPageRow[];
  signature: string;
  advertised: number;
  nextLabel: string;
  controls: string[];
  href: string;
};

type ChromeDom = {
  openOrClosedShadowRoot?: (element: Element) => ShadowRoot | null;
};

function clean(text: string): string {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/read more|read less|compatibility notes/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classText(el: Element): string {
  const value = el.className;
  return typeof value === "string" ? value : "";
}

function disabled(el: Element | null): boolean {
  return (
    !el ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("disabled") ||
    /disabled|pagination__next--disabled/i.test(classText(el))
  );
}

function inPhotos(el: Element): boolean {
  return Boolean(el.closest(".ux-image-carousel, .x-photos, #PicturePanel, .filmstrip, [class*='carousel']"));
}

function chromeDom(): ChromeDom | undefined {
  const chromeApi = (globalThis as { chrome?: { dom?: ChromeDom } }).chrome;
  return chromeApi?.dom;
}

function shadowOf(el: Element): ShadowRoot | null {
  try {
    return chromeDom()?.openOrClosedShadowRoot?.(el) ?? el.shadowRoot ?? null;
  } catch {
    return el.shadowRoot;
  }
}

const TABLE_SELECTOR = [
  "table",
  "[role='table']",
  ".motors-compatibility-table",
  "[data-testid='d-motors-compatibility-table']",
  "[data-testid='d-item-compatibility']",
  ".motors-compatibility-table-wrapper",
  ".comp-fitment-selector",
  ".x-compatibility-table",
  "[class*='compatibility-table']",
].join(", ");

function allRoots(): ParentNode[] {
  const roots: ParentNode[] = [document];
  const seen = new Set<ParentNode>([document]);
  const queue: ParentNode[] = [document];
  while (queue.length > 0 && roots.length < 30) {
    const node = queue.shift();
    if (!node) {
      break;
    }
    const hosts = Array.from(node.querySelectorAll(TABLE_SELECTOR)).slice(0, 40);
    for (const el of Array.from(node.querySelectorAll("*"))) {
      if (hosts.length >= 80) {
        break;
      }
      if (el.tagName.includes("-") || el.shadowRoot) {
        hosts.push(el);
      }
    }
    for (const el of hosts) {
      const shadow = shadowOf(el);
      if (shadow && !seen.has(shadow)) {
        seen.add(shadow);
        roots.push(shadow);
        queue.push(shadow);
      }
    }
  }
  return roots;
}

function cellsOf(row: Element): string[] {
  const cells = Array.from(row.querySelectorAll("td, [role='cell']"));
  return cells.map((cell) => clean(cell.textContent || ""));
}

function rowsFromTable(table: Element): FitmentPageRow[] {
  const rows: FitmentPageRow[] = [];
  const seen = new Set<string>();
  const rowNodes = Array.from(table.querySelectorAll("tbody tr, [role='row']"));
  for (const row of rowNodes) {
    const cells = cellsOf(row);
    const yearAt = cells.findIndex((cell) => /\b(?:19|20)\d{2}\b/.test(cell));
    if (yearAt < 0 || yearAt > 1 || cells.length < yearAt + 3) {
      continue;
    }
    const entry = {
      year: cells[yearAt] ?? "",
      make: cells[yearAt + 1] ?? "",
      model: cells[yearAt + 2] ?? "",
      trim: cells[yearAt + 3] ?? "",
      engine: cells[yearAt + 4] ?? "",
      notes: cells[yearAt + 5] ?? "",
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
  return rows;
}

function advertisedCount(scope: ParentNode): number {
  const hay = clean(scope instanceof Element ? scope.textContent || "" : document.body?.innerText || "").slice(0, 8000);
  const match =
    hay.match(/compatible with\s+([\d,]+)\s+vehicle/i) ||
    hay.match(/([\d,]+)\s+compatible vehicle/i) ||
    hay.match(/([\d,]+)\s+vehicle\(s\)/i) ||
    hay.match(/of\s+([\d,]+)\s+vehicle/i) ||
    hay.match(/see all\s+([\d,]+)/i);
  const digits = (match?.[1] ?? "").replace(/,/g, "");
  const value = /^\d+$/.test(digits) ? Number.parseInt(digits, 10) : 0;
  return Number.isFinite(value) ? value : 0;
}

function controlElements(scope: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const el of Array.from(scope.querySelectorAll("button, a, [role='button']"))) {
    if (el instanceof HTMLElement && !inPhotos(el)) {
      found.push(el);
    }
  }
  return found;
}

function nextControl(controls: HTMLElement[]): HTMLElement | null {
  const current = controls.find((el) => el.getAttribute("aria-current") === "page");
  const wanted = String((Number.parseInt(clean(current?.textContent || ""), 10) || 1) + 1);
  const ranked = controls.filter((el) => {
    if (disabled(el)) {
      return false;
    }
    const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
    const text = clean(el.textContent || "");
    if (/next image|next photo|next slide|previous/i.test(label)) {
      return false;
    }
    return (
      /pagination__next/i.test(classText(el)) ||
      el.getAttribute("rel") === "next" ||
      /next page|go to next/i.test(label) ||
      (text === wanted && /pagination/i.test(classText(el) + (el.parentElement ? classText(el.parentElement) : "")))
    );
  });
  return (
    ranked.find((el) =>
      /pagination__next|next page|go to next/i.test(`${el.getAttribute("aria-label") || ""} ${classText(el)}`),
    ) ||
    ranked[0] ||
    null
  );
}

function describe(controls: HTMLElement[]): string[] {
  return controls.slice(0, 12).map((el) => {
    const label = el.getAttribute("aria-label") || "";
    const text = clean(el.textContent || "").slice(0, 40);
    return `${el.tagName} label="${label}" text="${text}"`;
  });
}

function tablesIn(scope: ParentNode): { table: Element; rows: FitmentPageRow[]; scope: ParentNode } | null {
  let best: { table: Element; rows: FitmentPageRow[]; scope: ParentNode } | null = null;
  for (const table of Array.from(scope.querySelectorAll(TABLE_SELECTOR))) {
    const rows = rowsFromTable(table);
    if (!best || rows.length > best.rows.length) {
      best = { table, rows, scope };
    }
  }
  return best && best.rows.length > 0 ? best : null;
}

function bestTable(): { table: Element; rows: FitmentPageRow[]; scope: ParentNode } | null {
  const light = tablesIn(document);
  if (light && light.rows.length >= 5) {
    return light;
  }
  let best = light;
  for (const scope of allRoots()) {
    const found = tablesIn(scope);
    if (found && (!best || found.rows.length > best.rows.length)) {
      best = found;
    }
  }
  return best;
}

function pageControls(scope: ParentNode | null): HTMLElement[] {
  const local = scope ? controlElements(scope) : [];
  const next = nextControl(local);
  if (next) {
    return local;
  }
  return controlElements(document.body ?? document);
}

/** Reads the compatibility table, including one inside a closed shadow root. */
export function readFitmentPage(): FitmentPageSnapshot {
  const found = bestTable();
  const scope = found?.scope ?? document.body ?? document;
  const controls = pageControls(found?.scope ?? null);
  const next = nextControl(controls);
  const rows = found?.rows ?? [];
  const first = rows[0];
  const last = rows[rows.length - 1];
  found?.table.scrollIntoView({ block: "center" });
  return {
    rows,
    signature: first
      ? `${rows.length}|${first.year}|${first.make}|${first.model}|${last?.year ?? ""}|${last?.model ?? ""}`
      : "",
    advertised: Math.max(advertisedCount(scope), advertisedCount(document.body ?? document)),
    nextLabel: next ? next.getAttribute("aria-label") || clean(next.textContent || "") || classText(next) : "",
    controls: describe(controls),
    href: location.href,
  };
}

/** Clicks Next on the compatibility table. */
export function clickFitmentNext(): boolean {
  const found = bestTable();
  const next = nextControl(pageControls(found?.scope ?? null));
  if (!next) {
    return false;
  }
  next.scrollIntoView({ block: "center" });
  next.click();
  return true;
}

let expanded = false;

/** Opens a collapsed "see all compatible vehicles" control once. */
export function clickFitmentExpander(): boolean {
  if (expanded || bestTable()) {
    return false;
  }
  const match = /see all|show all|view all|compatible vehicle|see compatible|show more vehicles/i;
  for (const scope of allRoots()) {
    for (const el of controlElements(scope)) {
      const label = `${el.getAttribute("aria-label") || ""} ${clean(el.textContent || "")}`;
      if (!match.test(label) || /photo|image|slide/i.test(label) || disabled(el)) {
        continue;
      }
      if (el instanceof HTMLAnchorElement && el.href && !/ebay\.com\/itm\//i.test(el.href) && !el.href.startsWith("#")) {
        continue;
      }
      expanded = true;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    }
  }
  window.scrollBy(0, 900);
  return false;
}
