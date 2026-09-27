export const FITMENT_MAIN_MESSAGE = "SELL_SIMILAR_FITMENT_MAIN";

export type FitmentMainField = "year" | "make" | "model" | "trim" | "engine";

export type FitmentMainAction =
  | "guard"
  | "dismiss"
  | "ready"
  | "clear"
  | "select"
  | "save"
  | "persist"
  | "clear-all";

export type FitmentPersistMeta = {
  session: string;
  category: string;
  mode: string;
  features: string;
  flow: string;
  page: string;
  view: string;
};

export type FitmentPersistRow = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

export type FitmentMainRequest =
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "guard" }
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "dismiss" }
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "ready" }
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "clear" }
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "select"; field: FitmentMainField; value: string }
  | { type: typeof FITMENT_MAIN_MESSAGE; action: "save" }
  | {
      type: typeof FITMENT_MAIN_MESSAGE;
      action: "persist";
      meta: FitmentPersistMeta;
      rows: FitmentPersistRow[];
    }
  | {
      type: typeof FITMENT_MAIN_MESSAGE;
      action: "clear-all";
      meta: FitmentPersistMeta;
    };

export type FitmentMainResponse = {
  ok: boolean;
  ready?: boolean;
  hasYear?: boolean;
  hasMake?: boolean;
  hasModel?: boolean;
  patched?: number;
  filled?: number;
  cleared?: number;
  error?: string;
};

const MAIN_FIELDS: readonly FitmentMainField[] = ["year", "make", "model", "trim", "engine"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFitmentMainField(value: unknown): value is FitmentMainField {
  return typeof value === "string" && MAIN_FIELDS.includes(value as FitmentMainField);
}

export function isFitmentMainRequest(message: unknown): message is FitmentMainRequest {
  if (!isRecord(message) || message.type !== FITMENT_MAIN_MESSAGE) {
    return false;
  }
  switch (message.action) {
    case "guard":
    case "dismiss":
    case "ready":
    case "clear":
    case "save":
      return true;
    case "select":
      return isFitmentMainField(message.field) && typeof message.value === "string";
    case "persist":
      return isRecord(message.meta) && Array.isArray(message.rows);
    case "clear-all":
      return isRecord(message.meta);
    default:
      return false;
  }
}

/**
 * Do not wrap sellfit. Native Edit already renders the saved vehicles; a
 * datastore getter made eBay skip recreating the store and left a spinner.
 */
export function guardFitmentTree(): { ok: boolean; patched: number } {
  return { ok: true, patched: 0 };
}

export function keepFitmentSummaryVisible(): { ok: boolean } {
  if (window.name === "fitmentFrame" || /[/]sellfit/i.test(window.location.pathname)) {
    return { ok: true };
  }

  // Only clean up after the old inject-our-own-cards approach. The summary
  // count is eBay's to render: repainting it from sessionStorage is what made
  // a stale number survive page loads.
  document.querySelectorAll(".ss-fitment-card-list, .ss-fits-cards").forEach((node) => {
    node.remove();
  });
  document.getElementById("sell-similar-fitment-edit-css")?.remove();
  document.getElementById("fitsCnt")?.removeAttribute("data-ss-fits");
  document.body?.classList.remove("ss-fitment-applied", "ss-fitment-editing");
  try {
    sessionStorage.removeItem("ss-fitment-overlay");
    sessionStorage.removeItem("ss-fitment-cards");
    sessionStorage.removeItem("ss-fitment-editing");
  } catch {
    // sessionStorage may be blocked
  }

  return { ok: true };
}

export function hideFitmentSpinnerOverlay(): { ok: boolean } {
  return keepFitmentSummaryVisible();
}

export function dismissSellfitOverlay(): { ok: boolean } {
  return keepFitmentSummaryVisible();
}

export function installSellfitDatastoreGuard(): { ok: boolean } {
  return { ok: true };
}

export function interceptIdleFitmentLoad(): { ok: boolean } {
  return { ok: true };
}

/**
 * Reload eBay's native fitment-cards view after persist. Runs inside sellfit.
 */
export function showNativeFitmentCards(_filled: number): { ok: boolean } {
  return { ok: true };
}

/**
 * Apply vehicles through eBay's sellfit persist API. Do not reload or
 * inspect the Compatibility iframe afterward; persist fitmentCount is the
 * saved listing count.
 */
export async function persistFitmentViaApi(
  meta: FitmentPersistMeta,
  rows: FitmentPersistRow[],
): Promise<{ ok: boolean; filled?: number; error?: string }> {
  const session = String(meta?.session || "").trim();
  if (!session) {
    return { ok: false, error: "Missing listing session / draft id" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No fitment rows to persist" };
  }

  const SS = "[SellSimilar][fitment][persist]";
  console.info(`${SS} start`, {
    session,
    rows: rows.length,
    meta,
    firstRow: rows[0],
    lastRow: rows[rows.length - 1],
  });

  function valueForProp(prop: string, row: FitmentPersistRow): string {
    const name = String(prop || "").toLowerCase();
    if (name === "year") {
      return String(row.year || "").trim();
    }
    if (name === "make") {
      return String(row.make || "").trim();
    }
    if (name === "model") {
      return String(row.model || "").trim();
    }
    if (name === "trim" || name === "submodel") {
      return String(row.trim || "").trim();
    }
    if (name === "engine") {
      return String(row.engine || "").trim();
    }
    return "";
  }

  const nestDiagnostics: Array<Record<string, unknown>> = [];

  function nestFitments(props: string[]): Record<string, unknown> {
    const tree: Record<string, unknown> = {};
    for (const row of rows) {
      const rawPath = props.map((prop) => valueForProp(prop, row));

      // Position in this array IS the tree depth: [Make, Model, Year, Trim,
      // Engine]. Filtering empties out shifts every later value up a level, so
      // a row with no Trim but an Engine would file the engine under Trim and
      // hand eBay a structurally invalid tree. Stop at the first gap instead:
      // a missing level correctly means "everything below this point".
      const path: string[] = [];
      for (const value of rawPath) {
        if (!value) {
          break;
        }
        path.push(value);
      }

      if (path.length < rawPath.length) {
        nestDiagnostics.push({
          reason: "PATH_TRUNCATED_at_first_empty_level",
          props,
          rawPath,
          path,
          row,
        });
      }
      if (path.length < 3) {
        nestDiagnostics.push({ reason: "ROW_DROPPED_path_too_short", props, rawPath, path, row });
        continue;
      }
      let cursor: Record<string, unknown> = tree;
      for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index] ?? "";
        const existing = cursor[key];
        if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
          cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
      }
      const leaf = path[path.length - 1] ?? "";
      cursor[leaf] = [true, 1, row.notes || null];
    }
    return tree;
  }

  const query = new URLSearchParams();
  query.set("session", session);
  if (meta.category) {
    query.set("category", meta.category);
  }
  if (meta.mode) {
    query.set("mode", meta.mode);
  }
  if (meta.features) {
    query.set("features", meta.features);
  }
  if (meta.flow) {
    query.set("flow", meta.flow);
  }
  if (meta.page) {
    query.set("page", meta.page);
  }

  const csrfRes = await fetch(`/sellfit/api/csrf?session=${encodeURIComponent(session)}`, {
    credentials: "include",
  });
  if (!csrfRes.ok) {
    return { ok: false, error: `CSRF failed (${csrfRes.status})` };
  }
  const csrf = (await csrfRes.json()) as Record<string, string>;
  console.info(`${SS} csrf ok`, {
    keys: Object.keys(csrf),
    hasPersistToken: Boolean(csrf.persist),
  });

  const metaRes = await fetch(`/sellfit/api/metadata?${query.toString()}`, {
    credentials: "include",
  });
  if (!metaRes.ok) {
    return { ok: false, error: `Metadata failed (${metaRes.status})` };
  }
  const metaJson = (await metaRes.json()) as {
    metadata?: unknown;
    searchProps?: Array<{ propertyName?: string }>;
    treeDisplay?: {
      props?: Array<{ propertyName?: string }>;
      child?: unknown;
    };
  };

  function isNotesProp(name: string): boolean {
    return /^notes$/i.test(name);
  }

  function propertyNameFromUnknown(item: unknown): string {
    if (typeof item === "string") {
      return item.trim();
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return "";
    }
    const record = item as Record<string, unknown>;
    return String(record.propertyName || record.name || "").trim();
  }

  /**
   * Native persist metadata is an array of property names, ending in either
   * "Notes" or the [selected, total, notes] tuple. countProps (Trim/Engine)
   * live here, not on the L1 treeDisplay.props list.
   */
  function propertyNamesFromMetadata(metadata: unknown): string[] {
    if (!Array.isArray(metadata)) {
      return [];
    }
    const names: string[] = [];
    for (const item of metadata) {
      const name = propertyNameFromUnknown(item);
      if (name && !isNotesProp(name)) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Native getTreeLeaves flattens treeDisplay including nested `child`
   * (Trim/Engine). Reading only `.props` is what collapsed 20 rows into
   * Dodge → Dakota → 2004.
   */
  function propertyNamesFromTreeDisplay(treeDisplay: unknown): string[] {
    const names: string[] = [];
    let node: unknown = treeDisplay;
    while (node && typeof node === "object") {
      const record = node as { props?: unknown; child?: unknown };
      if (Array.isArray(record.props)) {
        for (const prop of record.props) {
          const name = propertyNameFromUnknown(prop);
          if (name && !isNotesProp(name)) {
            names.push(name);
          }
        }
      }
      node = record.child;
    }
    return names;
  }

  const metadataProps = propertyNamesFromMetadata(metaJson.metadata);
  const treeDisplayProps = propertyNamesFromTreeDisplay(metaJson.treeDisplay);
  const searchProps =
    metaJson.searchProps
      ?.map((item) => propertyNameFromUnknown(item))
      .filter((name) => name && !isNotesProp(name)) ?? [];

  let nestProps = metadataProps;
  if (treeDisplayProps.length > nestProps.length) {
    nestProps = treeDisplayProps;
  }
  if (searchProps.length > nestProps.length) {
    nestProps = searchProps;
  }
  const sourceHasTrimOrEngine = rows.some(
    (row) => String(row.trim || "").trim() || String(row.engine || "").trim(),
  );
  if (nestProps.length <= 3 && sourceHasTrimOrEngine) {
    nestProps = ["Make", "Model", "Year", "Trim", "Engine"];
  }
  const usingFallbackProps = nestProps.length < 3;
  if (usingFallbackProps) {
    nestProps = ["Make", "Model", "Year", "Trim", "Engine"];
  }
  const KNOWN_PROPS = ["year", "make", "model", "trim", "submodel", "engine"];
  console.info(`${SS} metadata ok`, {
    metadataProps,
    treeDisplayProps,
    searchProps,
    nestPropsUsed: nestProps,
    usingFallbackProps,
    treeDisplayHasChild: Boolean(
      metaJson.treeDisplay &&
        typeof metaJson.treeDisplay === "object" &&
        "child" in metaJson.treeDisplay &&
        metaJson.treeDisplay.child,
    ),
    unmappedProps: nestProps.filter(
      (prop) => !KNOWN_PROPS.includes(String(prop).toLowerCase()),
    ),
  });

  const fitments = nestFitments(nestProps);
  console.info(`${SS} tree built`, {
    topLevelKeys: Object.keys(fitments),
    rowsIn: rows.length,
    diagnosticCount: nestDiagnostics.length,
    diagnosticSample: nestDiagnostics.slice(0, 5),
  });
  if (Object.keys(fitments).length === 0) {
    console.warn(`${SS} EMPTY PAYLOAD`, {
      nestProps,
      diagnostics: nestDiagnostics.slice(0, 10),
    });
    return { ok: false, error: "Could not build persist payload from scraped rows" };
  }

  function countSelectedLeaves(value: unknown): number {
    let total = 0;
    const walk = (node: unknown): void => {
      if (typeof node === "number" && Number.isFinite(node)) {
        total += node;
        return;
      }
      if (Array.isArray(node)) {
        // Native summary collapses a year/make node to a number, then filter-db
        // rewrites it as [0, count, null]. Selected leaves are [true, n, notes].
        // Unselected leaves are [false, 0, notes]. Count from slot 1 when > 0.
        const flag = node[0];
        const count = Number(node[1]);
        if (count > 0 && Number.isFinite(count)) {
          total += count;
          return;
        }
        if (flag === true || flag === 1) {
          total += 1;
        }
        return;
      }
      if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        if ("selected" in record || "total" in record) {
          const selected = record.selected;
          if (selected === true) {
            total += Number(record.total) > 0 ? Number(record.total) : 1;
          } else if (typeof selected === "number" && selected > 0) {
            total += selected;
          }
          return;
        }
        for (const child of Object.values(record)) {
          walk(child);
        }
      }
    };
    walk(value);
    return total;
  }

  function unselectFitmentLeaves(value: unknown): unknown {
    if (typeof value === "number") {
      return [false, 0, null];
    }
    if (Array.isArray(value)) {
      return [false, 0, value[2] ?? null];
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const record = value as Record<string, unknown>;
    if ("selected" in record || "total" in record) {
      return [false, 0, record.notes ?? null];
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      out[key] = unselectFitmentLeaves(child);
    }
    return out;
  }

  async function fetchSummaryState(): Promise<{
    tree: Record<string, unknown> | null;
    treeSelected: number;
    fitmentCount: number | null;
    keys: string[];
    sample: string;
  }> {
    try {
      const response = await fetch(`/sellfit/api/summary?${query.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        return { tree: null, treeSelected: 0, fitmentCount: null, keys: [], sample: "" };
      }
      const body = (await response.json()) as Record<string, unknown>;
      const nested =
        body.summary && typeof body.summary === "object" && !Array.isArray(body.summary)
          ? (body.summary as Record<string, unknown>)
          : body.data && typeof body.data === "object" && !Array.isArray(body.data)
            ? (body.data as Record<string, unknown>)
            : body;
      const rawCount = Number(nested.fitmentCount ?? body.fitmentCount);
      const fitmentCount = Number.isFinite(rawCount) ? rawCount : null;
      let tree: Record<string, unknown> | null = null;
      let treeKey = "";
      for (const key of ["filterTree", "fitmentTree", "tree", "fitments", "selectedTree"]) {
        const candidate = nested[key] ?? body[key];
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
          tree = candidate as Record<string, unknown>;
          treeKey = key;
          break;
        }
      }
      return {
        tree,
        treeSelected: tree ? countSelectedLeaves(tree) : 0,
        fitmentCount,
        keys: Object.keys(body),
        sample: JSON.stringify({
          fitmentCount,
          treeKey,
          tree,
        }).slice(0, 1200),
      };
    } catch {
      return { tree: null, treeSelected: 0, fitmentCount: null, keys: [], sample: "" };
    }
  }

  function countFromCompatibilityHeading(): number {
    const heading = document.querySelector(
      ".smry.summary--fitments h3.message, .summary--fitments h3.message",
    );
    const match = heading?.textContent?.match(/(\d+)\s+vehicle/i);
    if (!match?.[1]) {
      return 0;
    }
    const count = Number.parseInt(match[1], 10);
    return Number.isNaN(count) ? 0 : count;
  }

  function persistBodyError(body: unknown): string | null {
    if (!body || typeof body !== "object") {
      return null;
    }
    const record = body as Record<string, unknown>;
    if (record.success === false || record.ok === false) {
      return String(record.error || record.message || record.errorMsg || "Persist response indicated failure");
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (typeof record.errorMsg === "string" && record.errorMsg.trim()) {
      return record.errorMsg;
    }
    if (typeof record.status === "string" && record.status && !/^success$/i.test(record.status)) {
      return `Persist status ${record.status}`;
    }
    if (typeof record.ack === "string" && /fail/i.test(record.ack)) {
      return `Persist ack ${record.ack}`;
    }
    return null;
  }

  function persistCountFromBody(body: unknown): number | null {
    if (!body || typeof body !== "object") {
      return null;
    }
    const count = Number((body as Record<string, unknown>).fitmentCount);
    return Number.isFinite(count) ? count : null;
  }

  async function persistToken(): Promise<string> {
    const csrfRes = await fetch(`/sellfit/api/csrf?session=${encodeURIComponent(session)}`, {
      credentials: "include",
    });
    if (!csrfRes.ok) {
      return "";
    }
    const csrfJson = (await csrfRes.json()) as Record<string, string>;
    return csrfJson.persist || "";
  }

  async function persistTree(
    token: string,
    tree: Record<string, unknown>,
  ): Promise<{
    ok: boolean;
    error?: string;
    fitmentCount: number | null;
    status: string;
    httpStatus: number;
    errorMsg: string | null;
    body: unknown;
  }> {
    const persistRes = await fetch("/sellfit/api/persist", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        srt: token,
      },
      body: JSON.stringify({
        session,
        metadata: metaJson.metadata ?? nestProps,
        fitments: tree,
      }),
    });
    if (!persistRes.ok) {
      const body = await persistRes.text();
      console.warn(`${SS} persist FAILED`, {
        httpStatus: persistRes.status,
        body: body.slice(0, 1000),
      });
      return {
        ok: false,
        error: `Persist failed (${persistRes.status}) ${body.slice(0, 180)}`,
        fitmentCount: null,
        status: String(persistRes.status),
        httpStatus: persistRes.status,
        errorMsg: body.slice(0, 180) || null,
        body,
      };
    }
    const persistBody = await persistRes.json().catch(() => undefined);
    const bodyError = persistBodyError(persistBody);
    const fitmentCount = persistCountFromBody(persistBody);
    const errorMsg =
      persistBody && typeof persistBody === "object"
        ? typeof (persistBody as Record<string, unknown>).errorMsg === "string"
          ? String((persistBody as Record<string, unknown>).errorMsg)
          : null
        : null;
    const status =
      persistBody && typeof persistBody === "object"
        ? String((persistBody as Record<string, unknown>).status || persistRes.status)
        : String(persistRes.status);
    if (bodyError) {
      console.warn(`${SS} persist REJECTED`, { httpStatus: persistRes.status, response: persistBody });
      return {
        ok: false,
        error: bodyError,
        fitmentCount,
        status,
        httpStatus: persistRes.status,
        errorMsg: errorMsg || bodyError,
        body: persistBody,
      };
    }
    console.info(`${SS} persist ok`, { httpStatus: persistRes.status, response: persistBody });
    return {
      ok: true,
      fitmentCount,
      status,
      httpStatus: persistRes.status,
      errorMsg,
      body: persistBody,
    };
  }

  const existing = await fetchSummaryState();
  const headingCount = countFromCompatibilityHeading();
  const existingCount = [existing.fitmentCount, existing.treeSelected, headingCount].find(
    (count) => typeof count === "number" && count > 0,
  ) ?? 0;
  console.info("[fitment][target] target existing count =", existingCount);
  console.info("[fitment][target] target existing tree/sample =", existing.sample);
  console.info("[fitment][persist] source rows =", rows.length);
  console.info("[fitment][persist] existing rows =", existingCount);
  console.info("[fitment][persist] operation = REPLACE");
  console.info(`${SS} existing target`, {
    summaryFitmentCount: existing.fitmentCount,
    treeSelected: existing.treeSelected,
    headingCount,
    summaryKeys: existing.keys,
  });

  const emptied = existing.tree
    ? (unselectFitmentLeaves(existing.tree) as Record<string, unknown>)
    : {};
  console.info("[fitment][persist] unselect payload =", JSON.stringify(emptied).slice(0, 1200));
  console.info("[fitment][persist] payload =", JSON.stringify(fitments).slice(0, 2000));

  if (existingCount > 0 && Object.keys(emptied).length === 0) {
    console.warn(`${SS} cannot REPLACE: eBay reports ${existingCount} vehicles but summary tree was empty`);
    return {
      ok: false,
      filled: 0,
      error: `Could not read existing target fitment tree to replace (${existingCount} vehicles). Target left unchanged.`,
    };
  }

  if (existingCount > 0 && Object.keys(emptied).length > 0) {
    const clearToken = csrf.persist || "";
    const cleared = await persistTree(clearToken, emptied);
    console.info("[fitment][persist] unselect status =", cleared.status);
    console.info("[fitment][persist] unselect fitmentCount =", cleared.fitmentCount);
    if (!cleared.ok) {
      return { ok: false, error: cleared.error || "Could not clear existing fitment before replace" };
    }
    const remaining =
      cleared.fitmentCount ?? (await fetchSummaryState()).fitmentCount;
    if (remaining == null) {
      console.warn(`${SS} unselect response had no fitmentCount`);
      return {
        ok: false,
        filled: 0,
        error: "Could not confirm existing vehicles were cleared before replace. Target left unchanged.",
      };
    }
    if (remaining > 0) {
      console.warn(`${SS} unselect did not clear target`, {
        remaining,
        existingCount,
      });
      return {
        ok: false,
        filled: remaining,
        error: `Could not clear existing vehicles before replace (server ${remaining}, expected 0). Target left unchanged.`,
      };
    }
  }

  const saveToken = existingCount > 0 ? (await persistToken()) || csrf.persist || "" : csrf.persist || "";
  const saved = await persistTree(saveToken, fitments);
  console.info("[fitment][persist] HTTP status =", saved.httpStatus);
  console.info("[fitment][persist] response status =", saved.status);
  console.info("[fitment][persist] response fitmentCount =", saved.fitmentCount);
  console.info("[fitment][persist] response errorMsg =", saved.errorMsg);
  console.info("[fitment][persist] expected source row count =", rows.length);
  if (!saved.ok) {
    if (existingCount > 0 && existing.tree) {
      const restoreToken = (await persistToken()) || csrf.persist || "";
      await persistTree(restoreToken, existing.tree);
    }
    return { ok: false, error: saved.error };
  }

  // eBay's fitmentCount is the saved vehicle total. A year row often expands
  // into more than one stored vehicle, so a higher server count is still a save.
  const persistedCount = saved.fitmentCount;
  const countOk =
    persistedCount == null || (persistedCount >= rows.length && persistedCount > 0);
  const passed =
    saved.httpStatus === 200 &&
    /^success$/i.test(saved.status) &&
    !saved.errorMsg &&
    countOk;
  console.info("[fitment][verify] persist fitmentCount =", persistedCount);
  console.info("[fitment][verify] expected count =", rows.length);
  console.info("[fitment][verify] result =", passed ? "PASS" : "FAIL");

  if (!passed) {
    console.warn(`${SS} REPLACE MISMATCH`, {
      httpStatus: saved.httpStatus,
      responseStatus: saved.status,
      persistFitmentCount: saved.fitmentCount,
      errorMsg: saved.errorMsg,
      expected: rows.length,
    });
    return {
      ok: false,
      filled: persistedCount ?? 0,
      error: `Fitment save did not replace existing vehicles (server ${persistedCount}, expected ${rows.length})`,
    };
  }

  document.querySelectorAll(".ss-fitment-card-list, .ss-fits-cards").forEach((node) => {
    node.remove();
  });
  document.getElementById("fitsCnt")?.removeAttribute("data-ss-fits");
  document.body?.classList.remove("ss-fitment-applied", "ss-fitment-editing");
  try {
    sessionStorage.removeItem("ss-fitment-overlay");
    sessionStorage.removeItem("ss-fitment-cards");
    sessionStorage.removeItem("ss-fitment-editing");
  } catch {
    // sessionStorage may be blocked
  }

  return { ok: true, filled: persistedCount != null && persistedCount > 0 ? persistedCount : rows.length };
}


/**
 * Unselect every vehicle on the listing through eBay's own persist API.
 *
 * Self-contained because it is injected into the page's MAIN world: it reads
 * the saved fitment tree, flips every leaf to unselected, and writes it back.
 */
export async function clearFitmentViaApi(
  meta: FitmentPersistMeta,
): Promise<{ ok: boolean; cleared?: number; error?: string }> {
  const session = String(meta?.session || "").trim();
  if (!session) {
    return { ok: false, error: "Missing listing session / draft id" };
  }

  const SS = "[SellSimilar][fitment][clear]";
  const query = new URLSearchParams();
  query.set("session", session);
  for (const [key, value] of [
    ["category", meta.category],
    ["mode", meta.mode],
    ["features", meta.features],
    ["flow", meta.flow],
    ["page", meta.page],
  ] as const) {
    if (value) {
      query.set(key, value);
    }
  }

  let cleared = 0;

  function unselectLeaves(value: unknown): unknown {
    if (typeof value === "number") {
      if (value > 0) {
        cleared += value;
      }
      return [false, 0, null];
    }
    if (Array.isArray(value)) {
      const count = Number(value[1]);
      if (value[0] === true || count > 0) {
        cleared += count > 0 ? count : 1;
      }
      return [false, 0, value[2] ?? null];
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const record = value as Record<string, unknown>;
    if ("selected" in record || "total" in record) {
      cleared += 1;
      return [false, 0, record.notes ?? null];
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      out[key] = unselectLeaves(child);
    }
    return out;
  }

  try {
    const csrfRes = await fetch(`/sellfit/api/csrf?session=${encodeURIComponent(session)}`, {
      credentials: "include",
    });
    if (!csrfRes.ok) {
      return { ok: false, error: `CSRF failed (${csrfRes.status})` };
    }
    const csrf = (await csrfRes.json()) as Record<string, string>;

    const metaRes = await fetch(`/sellfit/api/metadata?${query.toString()}`, {
      credentials: "include",
    });
    if (!metaRes.ok) {
      return { ok: false, error: `Metadata failed (${metaRes.status})` };
    }
    const metaJson = (await metaRes.json()) as { metadata?: unknown };

    const summaryRes = await fetch(`/sellfit/api/summary?${query.toString()}`, {
      credentials: "include",
    });
    if (!summaryRes.ok) {
      return { ok: false, error: `Summary failed (${summaryRes.status})` };
    }
    const summary = (await summaryRes.json()) as Record<string, unknown>;
    console.info(`${SS} summary keys`, Object.keys(summary));

    // eBay has used more than one field name for the saved tree; take whichever
    // is present rather than silently doing nothing.
    let tree: unknown = null;
    for (const key of ["filterTree", "fitmentTree", "tree", "fitments", "selectedTree"]) {
      const candidate = summary[key];
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        tree = candidate;
        console.info(`${SS} using summary field "${key}"`);
        break;
      }
    }

    if (!tree) {
      console.warn(`${SS} no saved tree found in summary`, {
        keys: Object.keys(summary),
        body: JSON.stringify(summary).slice(0, 600),
      });
      return {
        ok: false,
        cleared: 0,
        error: "eBay returned no saved compatibility tree to clear",
      };
    }

    const emptied = unselectLeaves(tree) as Record<string, unknown>;
    console.info(`${SS} clearing`, { cleared, topLevelKeys: Object.keys(emptied) });

    const persistRes = await fetch("/sellfit/api/persist", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", srt: csrf.persist || "" },
      body: JSON.stringify({
        session,
        metadata: metaJson.metadata ?? [],
        fitments: emptied,
      }),
    });
    if (!persistRes.ok) {
      const body = await persistRes.text();
      console.warn(`${SS} persist FAILED`, { status: persistRes.status, body: body.slice(0, 500) });
      return { ok: false, error: `Persist failed (${persistRes.status})` };
    }
    const persistBody = await persistRes.json().catch(() => undefined);
    console.info(`${SS} persist ok`, { status: persistRes.status, response: persistBody });

    try {
      sessionStorage.removeItem("ss-fitment-overlay");
      sessionStorage.removeItem("ss-fitment-cards");
      sessionStorage.removeItem("ss-fitment-editing");
    } catch {
      // sessionStorage may be blocked
    }

    console.info(`${SS} cleared ${cleared} entries`);
    return { ok: true, cleared };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function inspectFitmentPicker(): {
  ready: boolean;
  hasYear: boolean;
  hasMake: boolean;
  hasModel: boolean;
} {
  function isShown(el: Element | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }

  function present(selector: string): boolean {
    return Array.from(document.querySelectorAll(selector)).some(isShown);
  }

  for (const node of document.querySelectorAll(
    '[class*="progress-spinner"], [class*="overlay-spinner"], .se-spinner, .spinner--overlay',
  )) {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width >= 24 && rect.height >= 24) {
      return { ready: false, hasYear: false, hasMake: false, hasModel: false };
    }
  }

  const hasYear = present(
    'button[aria-label*="Year" i], select[name="year"], [role="combobox"][aria-label*="Year" i]',
  );
  const hasMake = present(
    'button[aria-label*="Make" i], select[name="make"], [role="combobox"][aria-label*="Make" i]',
  );
  const hasModel = present(
    'button[aria-label*="Model" i], select[name="model"], [role="combobox"][aria-label*="Model" i]',
  );
  return { ready: hasYear || hasMake || hasModel, hasYear, hasMake, hasModel };
}

export function clearFitmentPicker(): { ok: boolean } {
  function isShown(el: Element | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }

  for (const node of document.querySelectorAll(
    '[class*="progress-spinner"], [class*="overlay-spinner"], .se-spinner, .spinner--overlay',
  )) {
    if (node instanceof HTMLElement) {
      node.style.setProperty("pointer-events", "none", "important");
    }
  }

  const selectAll = document.querySelector(
    'input[type="checkbox"][aria-label*="Select all" i], input[type="checkbox"][aria-label*="all" i]',
  );
  if (selectAll instanceof HTMLInputElement && !selectAll.checked) {
    selectAll.click();
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    if (!(btn instanceof HTMLElement) || !isShown(btn)) {
      continue;
    }
    const text = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (
      text.includes("remove all") ||
      text.includes("remove selected") ||
      text.includes("delete selected") ||
      text.includes("clear all") ||
      text === "remove" ||
      text === "delete"
    ) {
      btn.click();
      return { ok: true };
    }
  }

  const checked = document.querySelectorAll(
    '[role="checkbox"][aria-checked="true"], input[type="checkbox"]:checked',
  );
  for (const node of checked) {
    if (node instanceof HTMLElement && isShown(node)) {
      node.click();
    }
  }

  return { ok: true };
}

export async function selectFitmentControl(
  field: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const needle = String(value || "").trim();
  if (!needle) {
    return { ok: true };
  }
  if (field !== "year" && field !== "make" && field !== "model" && field !== "trim" && field !== "engine") {
    return { ok: false, error: `Unknown field ${field}` };
  }

  function isShown(el: Element | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }

  function optionMatches(text: string, wanted: string): boolean {
    const option = text.replace(/\s+/g, " ").trim().toLowerCase();
    const wantedText = wanted.replace(/\s+/g, " ").trim().toLowerCase();
    if (!option || !wantedText) {
      return false;
    }
    if (/^(make|model)\s*z-?a$/.test(option) || /year\s*(ascending|descending)/.test(option)) {
      return false;
    }
    if (/^select all( that apply)?$/.test(option)) {
      return false;
    }
    return option === wantedText || option.includes(wantedText) || wantedText.includes(option);
  }

  function clickMatchingChoice(wanted: string): boolean {
    const options = document.querySelectorAll(
      '[role="option"], [role="menuitemcheckbox"], [role="menuitem"], [role="treeitem"], [role="checkbox"], .listbox-button__option, .menu__item',
    );
    for (const option of options) {
      if (!isShown(option)) {
        continue;
      }
      const text = `${option.textContent || ""} ${option.getAttribute("aria-label") || ""}`;
      if (!optionMatches(text, wanted)) {
        continue;
      }
      const checked =
        option.getAttribute("aria-checked") === "true" ||
        (option instanceof HTMLInputElement && option.checked);
      if (!checked) {
        option.click();
      }
      return true;
    }
    return false;
  }

  for (const node of document.querySelectorAll(
    '[class*="progress-spinner"], [class*="overlay-spinner"], .se-spinner, .spinner--overlay',
  )) {
    if (node instanceof HTMLElement) {
      node.style.setProperty("pointer-events", "none", "important");
    }
  }

  let selector = "";
  switch (field) {
    case "year":
      selector =
        'button[aria-label*="Year" i], select[name="year"], [role="combobox"][aria-label*="Year" i]';
      break;
    case "make":
      selector =
        'button[aria-label*="Make" i], select[name="make"], [role="combobox"][aria-label*="Make" i]';
      break;
    case "model":
      selector =
        'button[aria-label*="Model" i], select[name="model"], [role="combobox"][aria-label*="Model" i]';
      break;
    case "trim":
      selector =
        'button[aria-label*="Trim" i], select[name="trim"], [role="combobox"][aria-label*="Trim" i]';
      break;
    case "engine":
      selector =
        'button[aria-label*="Engine" i], select[name="engine"], [role="combobox"][aria-label*="Engine" i]';
      break;
    default: {
      const _exhaustive: never = field;
      return { ok: false, error: String(_exhaustive) };
    }
  }

  const control = Array.from(document.querySelectorAll(selector)).find(isShown);
  if (!control) {
    if (clickMatchingChoice(needle)) {
      return { ok: true };
    }
    if (field === "trim" || field === "engine") {
      return { ok: true };
    }
    return { ok: false, error: `${field} control not found` };
  }

  if (control instanceof HTMLSelectElement) {
    const option = Array.from(control.options).find((item) => optionMatches(item.text, needle));
    if (!option) {
      return { ok: false, error: `No ${field} option for ${value}` };
    }
    control.value = option.value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }

  if (control.getAttribute("aria-expanded") !== "true") {
    control.click();
    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });
  }

  if (clickMatchingChoice(needle)) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });
    if (control.getAttribute("aria-expanded") === "true" && (field === "make" || field === "model")) {
      control.click();
    }
    return { ok: true };
  }

  if (control.getAttribute("aria-expanded") === "true") {
    control.click();
  }
  if (field === "trim" || field === "engine") {
    return { ok: true };
  }
  return { ok: false, error: `No ${field} option for ${value}` };
}

export function saveFitmentPicker(): { ok: boolean } {
  function isShown(el: Element | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }

  for (const node of document.querySelectorAll(
    '[class*="progress-spinner"], [class*="overlay-spinner"], .se-spinner, .spinner--overlay',
  )) {
    if (node instanceof HTMLElement) {
      node.style.setProperty("pointer-events", "none", "important");
    }
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    if (!(btn instanceof HTMLElement) || !isShown(btn)) {
      continue;
    }
    const text = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (
      text === "save" ||
      text === "apply" ||
      text === "done" ||
      text === "confirm" ||
      text === "save and close" ||
      text === "apply selected"
    ) {
      btn.click();
      return { ok: true };
    }
  }
  return { ok: false };
}
