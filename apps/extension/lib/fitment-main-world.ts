export const FITMENT_MAIN_MESSAGE = "SELL_SIMILAR_FITMENT_MAIN";

export type FitmentMainField = "year" | "make" | "model" | "trim" | "engine";

export type FitmentMainAction =
  | "guard"
  | "dismiss"
  | "ready"
  | "clear"
  | "select"
  | "save"
  | "persist";

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
    };

export type FitmentMainResponse = {
  ok: boolean;
  ready?: boolean;
  hasYear?: boolean;
  hasMake?: boolean;
  hasModel?: boolean;
  patched?: number;
  filled?: number;
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
  if (window.name === "fitmentFrame" || /\/sellfit/i.test(window.location.pathname)) {
    return { ok: true };
  }

  document.querySelectorAll(".ss-fitment-card-list, .ss-fits-cards").forEach((node) => node.remove());
  document.getElementById("sell-similar-fitment-edit-css")?.remove();
  document.body?.classList.remove("ss-fitment-editing");

  const overlayKey = "ss-fitment-overlay";
  const params = new URLSearchParams(window.location.search);
  const draftId = String(params.get("draftId") || "").trim();
  const itemId = String(params.get("itemId") || "").trim();
  let session = "";
  const host = document.querySelector("[data-testid='fitment-frame']");
  const rawMeta = host?.getAttribute("data-frame-meta");
  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta) as { session?: unknown };
      session = String(parsed.session || "").trim();
    } catch {
      session = "";
    }
  }

  let stored: { session: string; draftId: string; itemId: string; filled: number } | null = null;
  try {
    sessionStorage.removeItem("ss-fitment-cards");
    const raw = sessionStorage.getItem(overlayKey);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        session?: unknown;
        draftId?: unknown;
        itemId?: unknown;
        filled?: unknown;
        rows?: unknown;
      };
      const rowCount = Array.isArray(parsed.rows) ? parsed.rows.length : 0;
      stored = {
        session: String(parsed.session ?? ""),
        draftId: String(parsed.draftId ?? ""),
        itemId: String(parsed.itemId ?? ""),
        filled: Number(parsed.filled) || rowCount,
      };
    }
  } catch {
    stored = null;
  }

  if (!stored) {
    return { ok: true };
  }
  const storedIds = [stored.session, stored.draftId, stored.itemId].filter(Boolean);
  const currentIds = [session || draftId, draftId, itemId].filter(Boolean);
  if (!storedIds.some((id) => currentIds.includes(id))) {
    return { ok: true };
  }

  const heading = document.querySelector(
    ".smry.summary--fitments h3.message, .summary--fitments h3.message",
  );
  if (heading && stored.filled > 0) {
    heading.textContent =
      stored.filled === 1
        ? "1 compatible vehicle added."
        : `${stored.filled} compatible vehicles added.`;
    heading.removeAttribute("role");
    heading.removeAttribute("tabindex");
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
 * Apply vehicles through eBay's sellfit persist API, then load the native
 * fitment-cards view so Edit can open the real vehicle modal.
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

  function nestFitments(props: string[]): Record<string, unknown> {
    const tree: Record<string, unknown> = {};
    for (const row of rows) {
      const path = props.map((prop) => valueForProp(prop, row)).filter(Boolean);
      if (path.length < 3) {
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

  const metaRes = await fetch(`/sellfit/api/metadata?${query.toString()}`, {
    credentials: "include",
  });
  if (!metaRes.ok) {
    return { ok: false, error: `Metadata failed (${metaRes.status})` };
  }
  const metaJson = (await metaRes.json()) as {
    metadata?: unknown;
    treeDisplay?: { props?: Array<{ propertyName?: string }> };
  };

  const props =
    metaJson.treeDisplay?.props
      ?.map((item) => String(item.propertyName || "").trim())
      .filter((name) => name && name.toLowerCase() !== "notes") ?? [];
  const nestProps = props.length >= 3 ? props : ["Make", "Model", "Year", "Trim", "Engine"];
  const fitments = nestFitments(nestProps);
  if (Object.keys(fitments).length === 0) {
    return { ok: false, error: "Could not build persist payload from scraped rows" };
  }

  function unselectFitmentLeaves(value: unknown): unknown {
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

  function mergeFitmentTrees(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      const existing = result[key];
      const overlayIsLeaf = Array.isArray(value);
      const existingIsBranch =
        existing && typeof existing === "object" && !Array.isArray(existing);
      const overlayIsBranch = value && typeof value === "object" && !Array.isArray(value);
      if (overlayIsLeaf || !overlayIsBranch || !existingIsBranch) {
        result[key] = value;
        continue;
      }
      result[key] = mergeFitmentTrees(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    }
    return result;
  }

  async function existingUnselectedTree(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`/sellfit/api/summary?${query.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        return {};
      }
      const body = (await response.json()) as { filterTree?: unknown };
      const tree = body.filterTree;
      if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
        return {};
      }
      const cleared = unselectFitmentLeaves(tree);
      if (cleared && typeof cleared === "object" && !Array.isArray(cleared)) {
        return cleared as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }

  const persistPayload = mergeFitmentTrees(await existingUnselectedTree(), fitments);

  async function persistTree(
    token: string,
    tree: Record<string, unknown>,
  ): Promise<Response> {
    return fetch("/sellfit/api/persist", {
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
  }

  const persistRes = await persistTree(csrf.persist || "", persistPayload);
  if (!persistRes.ok) {
    const body = await persistRes.text();
    return { ok: false, error: `Persist failed (${persistRes.status}) ${body.slice(0, 180)}` };
  }

  await persistRes.json().catch(() => undefined);
  const filled = rows.length;

  function restoreIdleFitmentUi(): void {
    const countMessage =
      filled === 1 ? "1 compatible vehicle added." : `${filled} compatible vehicles added.`;
    const heading = document.querySelector(
      ".smry.summary--fitments h3.message, .summary--fitments h3.message",
    );
    if (heading) {
      heading.textContent = countMessage;
    }

    document.querySelectorAll(".ss-fitment-card-list, .ss-fits-cards").forEach((node) => node.remove());
    document.getElementById("fitsCnt")?.removeAttribute("data-ss-fits");
    document.body?.classList.remove("ss-fitment-applied", "ss-fitment-editing");

    const params = new URLSearchParams(window.location.search);
    try {
      sessionStorage.removeItem("ss-fitment-cards");
      sessionStorage.setItem(
        "ss-fitment-overlay",
        JSON.stringify({
          session,
          draftId: String(params.get("draftId") || "").trim(),
          itemId: String(params.get("itemId") || "").trim(),
          rows,
          filled,
        }),
      );
      sessionStorage.removeItem("ss-fitment-editing");
    } catch {
      // sessionStorage may be blocked
    }
  }

  restoreIdleFitmentUi();
  return { ok: true, filled };
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
