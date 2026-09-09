import type { VehicleCompatibility } from "@sell-similar/contracts";
import { fillFitmentResult, type FillFitmentResult } from "./fill-fitment-messages.ts";
import { fitmentLog, fitmentWarn } from "./fitment-debug.ts";
import {
  FITMENT_MAIN_MESSAGE,
  type FitmentMainField,
  type FitmentMainRequest,
  type FitmentMainResponse,
  type FitmentPersistMeta,
} from "./fitment-main-world.ts";

export type { FillFitmentResult };

type FitmentField = "year" | "make" | "model" | "trim" | "engine";

type MakeModelGroup = {
  make: string;
  model: string;
  years: string[];
  trims: string[];
  engines: string[];
  rows: VehicleCompatibility[];
};

type FitmentChoice = {
  name: string;
  row: HTMLElement;
  clickTarget: HTMLElement;
  checkbox: HTMLInputElement | null;
};

let capturedExistingCount = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitUntil(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return true;
    }
    await delay(200);
  }
  return check();
}

function normalize(text: string): string {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function exactText(left: string, right: string): boolean {
  return normalize(left).toLowerCase() === normalize(right).toLowerCase();
}

function optionMatches(label: string, wanted: string): boolean {
  const option = normalize(label).toLowerCase();
  const needle = normalize(wanted).toLowerCase();
  if (!option || !needle) {
    return false;
  }
  if (/^(make|model)\s*z-?a$/.test(option) || /year\s*(ascending|descending)/.test(option)) {
    return false;
  }
  if (/^select all( that apply)?$/.test(option)) {
    return false;
  }
  return option === needle || option.includes(needle) || needle.includes(option);
}

function uniqueValues(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = normalize(value || "");
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function groupByMakeModel(rows: VehicleCompatibility[]): MakeModelGroup[] {
  const groups = new Map<string, MakeModelGroup>();
  for (const row of rows) {
    const make = normalize(row.make);
    const model = normalize(row.model);
    const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(key, { make, model, years: [], trims: [], engines: [], rows: [row] });
  }
  for (const group of groups.values()) {
    group.years = uniqueValues(group.rows.map((row) => row.year)).sort();
    group.trims = uniqueValues(group.rows.map((row) => row.trim));
    group.engines = uniqueValues(group.rows.map((row) => row.engine));
  }
  return [...groups.values()];
}

function isShown(el: Element | null): boolean {
  if (!(el instanceof HTMLElement) || !el.isConnected) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
}

function fireClick(el: HTMLElement): void {
  el.scrollIntoView({ block: "center", inline: "nearest" });
  el.click();
}

function getExistingFitmentCount(): number {
  const selectors = [".smry.summary--fitments", ".summary--fitments", ".summary__compatibility"];
  for (const selector of selectors) {
    const section = document.querySelector(selector);
    const match = section?.textContent?.match(/(\d+)\s+vehicle/i);
    if (match?.[1]) {
      const count = Number.parseInt(match[1], 10);
      if (!Number.isNaN(count)) {
        return count;
      }
    }
  }
  return 0;
}

function findCompatibilitySection(): Element | null {
  const selectors = [".smry.summary--fitments", ".summary--fitments", '[data-testid="fitment-frame"]'];
  for (const selector of selectors) {
      const section = document.querySelector(selector);
      if (section) {
        return section;
      }
  }
  for (const heading of document.querySelectorAll("h2.textual-display")) {
    if (heading.textContent?.trim() === "Compatibility") {
      return heading.closest(".smry, .summary--fitments");
    }
  }
  return null;
}

const ADD_VEHICLE_PATTERNS = [
  /add (a )?(compatible )?vehicles?/i,
  /add another( vehicle)?/i,
  /manually add/i,
  /this (item|part) fits/i,
  /fits? (a )?specific vehicles?/i,
  /select vehicles?/i,
  /^yes$/i,
  /^add$/i,
];

function isHeaderEditButton(el: Element): boolean {
  return Boolean(
    el.closest(".summary__header-edit-button, .summary__header") &&
      /edit/i.test(`${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`),
  );
}

function findAddControlIn(root: ParentNode): HTMLElement | null {
  const nodes = root.querySelectorAll("button, a, [role='button'], label, input[type='radio']");
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || isHeaderEditButton(node)) {
      continue;
    }
    const text = normalize(`${node.textContent || ""} ${node.getAttribute("aria-label") || ""}`);
    if (ADD_VEHICLE_PATTERNS.some((pattern) => pattern.test(text))) {
      return node;
    }
  }
  return null;
}

function findAddFitmentControl(): HTMLElement | null {
  const section = findCompatibilitySection();
  if (!section) {
  return null;
  }
  return findAddControlIn(section);
}

function refreshFitmentUI(): void {
  fitmentLog("Fitment saved; leaving eBay Compatibility iframe untouched");
}

function expandFitmentIframe(): HTMLIFrameElement | null {
  const section = findCompatibilitySection();
  const wrapper =
    (section instanceof Element ? section.querySelector(".fitment-wrapper") : null) ??
    document.querySelector(".fitment-wrapper");
  if (wrapper instanceof HTMLElement) {
    wrapper.classList.remove("empty");
    wrapper.hidden = false;
    wrapper.removeAttribute("hidden");
    wrapper.style.setProperty("display", "block", "important");
    wrapper.style.setProperty("height", "auto", "important");
    wrapper.style.setProperty("min-height", "520px", "important");
    wrapper.style.setProperty("max-height", "none", "important");
    wrapper.style.setProperty("overflow", "visible", "important");
    wrapper.style.setProperty("visibility", "visible", "important");
  }

  const frameHost = document.querySelector('[data-testid="fitment-frame"]');
  if (frameHost instanceof HTMLElement) {
    frameHost.style.setProperty("visibility", "visible", "important");
    frameHost.style.setProperty("height", "auto", "important");
    frameHost.style.setProperty("min-height", "520px", "important");
    frameHost.style.setProperty("overflow", "visible", "important");
  }

  const iframe = fitmentIframeElement();
  if (!iframe) {
    return null;
  }
  iframe.hidden = false;
  iframe.style.setProperty("display", "block", "important");
  iframe.style.setProperty("height", "640px", "important");
  iframe.style.setProperty("min-height", "520px", "important");
  iframe.style.setProperty("max-height", "none", "important");
  iframe.style.setProperty("visibility", "visible", "important");
  return iframe;
}

function lockFitmentIframe(): void {
  const win = window as Window & { __ssFitmentIframeLock?: MutationObserver };
  fitmentLog("Locking fitment iframe");

  const iframe = fitmentIframeElement();
  if (!iframe) {
    fitmentLog("No iframe found to lock");
    return;
  }

  function applyLock(target: HTMLIFrameElement): void {
    target.style.minHeight = "400px";
    target.style.maxHeight = "none";
    target.style.height = "400px";
  }

  applyLock(iframe);

  if (!win.__ssFitmentIframeLock) {
    const observer = new MutationObserver(() => {
      if (
        iframe.style.maxHeight === "82px" ||
        iframe.style.minHeight === "82px" ||
        iframe.style.height === "82px" ||
        iframe.offsetHeight < 100
      ) {
        applyLock(iframe);
      }
    });
    observer.observe(iframe, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    win.__ssFitmentIframeLock = observer;
  }

  const wrapper = document.querySelector(".fitment-wrapper");
  if (wrapper instanceof HTMLElement) {
    wrapper.style.maxHeight = "none";
    wrapper.style.height = "auto";
  }

  fitmentLog("Fitment iframe locked at 400px");
}

function isPickerContext(): boolean {
  try {
    if (window.name === "fitmentFrame") {
      return true;
    }
    return /\/sellfit/i.test(window.location.pathname);
  } catch {
    return false;
  }
}

function fitmentIframeElement(): HTMLIFrameElement | null {
  for (const iframe of document.querySelectorAll("iframe")) {
    if (!(iframe instanceof HTMLIFrameElement)) {
      continue;
    }
    if (iframe.name === "fitmentFrame" || iframe.src.includes("sellfit")) {
      return iframe;
    }
  }
  return null;
}

function liveFitmentIframe(): HTMLIFrameElement | null {
  const iframe = fitmentIframeElement();
  if (iframe && iframe.offsetHeight > 40) {
    return iframe;
  }
  return null;
}

function iframeDocument(): Document | null {
  const iframe = liveFitmentIframe() ?? fitmentIframeElement();
  try {
    return iframe?.contentDocument ?? null;
  } catch {
    return null;
  }
}

function readFitmentFrameMeta(): FitmentPersistMeta | null {
  const host = document.querySelector("[data-testid='fitment-frame']");
  const raw = host?.getAttribute("data-frame-meta");
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  const nested = host?.querySelector("[data-fits-meta]");
  const nestedRaw = nested?.getAttribute("data-fits-meta");
  if (nestedRaw) {
    try {
      const wrap = JSON.parse(nestedRaw) as { meta?: Record<string, unknown> };
      if (wrap.meta) {
        parsed = { ...wrap.meta, ...parsed };
      }
    } catch {
      // ignore
    }
  }

  let session = typeof parsed.session === "string" ? parsed.session : "";
  if (!session) {
    try {
      session = new URL(window.location.href).searchParams.get("draftId") || "";
    } catch {
      session = "";
    }
  }
  if (!session) {
    return null;
  }

  return {
    session,
    category: typeof parsed.category === "string" ? parsed.category : "",
    mode: typeof parsed.mode === "string" ? parsed.mode : "ReviseItem",
    features: typeof parsed.features === "string" ? parsed.features : "",
    flow: typeof parsed.flow === "string" ? parsed.flow : "helix",
    page: typeof parsed.page === "string" ? parsed.page : "list",
    view: typeof parsed.view === "string" ? parsed.view : "edit-fitments",
  };
}

async function persistScrapedFitment(
  validRows: VehicleCompatibility[],
  existingCount: number,
): Promise<FillFitmentResult> {
  const meta = readFitmentFrameMeta();
  if (!meta) {
    return fillFitmentResult({
      sectionFound: Boolean(findCompatibilitySection()),
      skipped: validRows.length,
      warnings: ["Could not read fitment session from the listing editor"],
      existingCount,
      code: "TARGET_EDITOR_CHANGED",
    });
  }

  fitmentLog("Persisting scraped vehicles via sellfit API", `${validRows.length} rows session=${meta.session}`);
  const result = await callFitmentMain({
    type: FITMENT_MAIN_MESSAGE,
    action: "persist",
    meta,
    rows: validRows.map((row) => ({
      year: normalize(row.year),
      make: normalize(row.make),
      model: normalize(row.model),
      trim: normalize(row.trim),
      engine: normalize(row.engine),
      notes: normalize(row.notes),
    })),
  });

  if (!result?.ok) {
    fitmentWarn("Sellfit persist failed", result?.error || "unknown");
    return fillFitmentResult({
      sectionFound: true,
      skipped: validRows.length,
      warnings: [result?.error || "Could not save fitment through eBay's persist API"],
      existingCount,
      code: "VERIFICATION_FAILED",
    });
  }

  const filled = validRows.length;
  fitmentLog("Sellfit persist succeeded", `filled=${filled} ebayCount=${result.filled || filled}`);
  fitmentLog(`Added ${filled}/${validRows.length} vehicles`);
  lockFitmentIframe();
  await callFitmentMain({ type: FITMENT_MAIN_MESSAGE, action: "dismiss" });
  refreshFitmentUI();
  return fillFitmentResult({
    sectionFound: true,
    cleared: existingCount > 0,
    filled,
    skipped: Math.max(0, validRows.length - filled),
    existingCount,
  });
}

function findEditFitmentButton(): HTMLElement | null {
  const section = findCompatibilitySection();
  if (!section) {
    return null;
  }
  const headerBtn = section.querySelector(".summary__header-edit-button");
  if (headerBtn instanceof HTMLElement && headerBtn.isConnected) {
    return headerBtn;
  }
  for (const btn of section.querySelectorAll("button")) {
    if (!(btn instanceof HTMLElement)) {
      continue;
    }
    const text = normalize(`${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`);
    if (/^edit$/i.test(text) || /edit compatibility|edit fitment/i.test(text)) {
      return btn;
    }
  }
  return findAddFitmentControl();
}

function parentFitmentDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll(
    ".lightbox-dialog:not([hidden]), [role='dialog']:not([hidden]), [class*='lightbox-dialog'], .drawer:not([hidden])",
  );
  for (const dialog of dialogs) {
    if (dialog instanceof HTMLElement && isShown(dialog) && looksLikeFitmentUi(dialog)) {
      return dialog;
    }
  }
  return null;
}

function fillDoc(): Document | null {
  if (isPickerContext()) {
    return document;
  }
  const iframe = liveFitmentIframe() ?? fitmentIframeElement();
  try {
    const doc = iframe?.contentDocument;
    if (doc?.body && pickerControlsIn(doc.body)) {
      return doc;
    }
  } catch {
    // iframe document not ready
  }
  if (parentFitmentDialog()) {
    return document;
  }
  return null;
}

function visibleListingSpinner(): boolean {
  const nodes = document.querySelectorAll(
    '.progress-spinner, [class*="progress-spinner"], [class*="overlay-spinner"], [aria-busy="true"]',
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width > 40 && rect.height > 40) {
      return true;
    }
  }
  return false;
}

async function waitForEditorIdle(): Promise<void> {
  fitmentLog("Waiting for listing editor to idle");
  await waitUntil(() => Boolean(findCompatibilitySection()) && !visibleListingSpinner(), 15000);
  await delay(800);
}

function pickerControlsIn(root: ParentNode): boolean {
  if (findFieldControl("make", root) || findFieldControl("year", root)) {
    return true;
  }
  return Boolean(
    root.querySelector(
      "button[aria-label*='Make' i], select[name='make'], button[aria-label*='Year' i], select[name='year']",
    ),
  );
}

function looksLikeFitmentUi(el: HTMLElement): boolean {
  const text = normalize(el.textContent ?? "").slice(0, 1200).toLowerCase();
  return (
    text.includes("make") &&
    (text.includes("model") || text.includes("year") || text.includes("compatibility") || text.includes("trim"))
  );
}

function fillRoot(): HTMLElement {
  const dialog = parentFitmentDialog();
  if (dialog) {
    return dialog;
  }
  const doc = fillDoc();
  if (!doc) {
    return document.body;
  }
  const dialogs = doc.querySelectorAll(
    ".lightbox-dialog:not([hidden]), [role='dialog']:not([hidden]), [class*='lightbox-dialog']",
  );
  for (const node of dialogs) {
    if (node instanceof HTMLElement && isShown(node) && looksLikeFitmentUi(node)) {
      return node;
    }
  }
  return doc.body;
}

function isListingEditorStillActive(): boolean {
  if (isPickerContext()) {
    return true;
  }
  try {
    const path = new URL(window.location.href).pathname.toLowerCase();
    return ["/lstng", "/listing", "/lst", "/sl"].some(
      (editorPath) => path === editorPath || path.startsWith(`${editorPath}/`),
    );
  } catch {
    return false;
  }
}

function fieldLabelPattern(field: FitmentField): RegExp {
  switch (field) {
    case "year":
      return /^year$/i;
    case "make":
      return /^make$/i;
    case "model":
      return /^model$/i;
    case "trim":
      return /^(trim|submodel)$/i;
    case "engine":
      return /^engine$/i;
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

function cascadeControl(field: FitmentField, root: ParentNode): HTMLElement | null {
  if (field !== "make" && field !== "model" && field !== "year") {
    return null;
  }
  const order: Array<"make" | "model" | "year"> = ["make", "model", "year"];
  const placeholders = Array.from(
    root.querySelectorAll("button.enhanced-select-placeholder, button[role='combobox'], .listbox-button__control"),
  ).filter((el): el is HTMLElement => el instanceof HTMLElement && isShown(el));
  if (placeholders.length >= 3) {
    return placeholders[order.indexOf(field)] ?? null;
  }
  return null;
}

function findFieldControl(field: FitmentField, root: ParentNode): HTMLElement | null {
  const cascade = cascadeControl(field, root);
  if (cascade) {
    return cascade;
  }

  const named = root.querySelector(
    `select[name='${field}'], button[name='${field}'], [aria-label*='${field}' i]`,
  );
  if (named instanceof HTMLElement && isShown(named)) {
    return named;
  }

  const pattern = fieldLabelPattern(field);
  const candidates = root.querySelectorAll("button, select, [role='combobox'], label");
  for (const node of candidates) {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
              continue;
            }
    const text = normalize(`${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`);
    if (pattern.test(text.split("\n")[0] ?? "") || pattern.test(text.slice(0, 24))) {
      if (node instanceof HTMLLabelElement) {
        const control = node.control;
        if (control instanceof HTMLElement) {
          return control;
        }
      }
      return node;
    }
  }
  return null;
}

function blockingSpinnerIn(root: ParentNode): boolean {
  const nodes = root.querySelectorAll(
    '[class*="progress-spinner"], [class*="overlay-spinner"], .se-spinner, .spinner--overlay, [class*="page-spinner"]',
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width >= 24 && rect.height >= 24) {
      return true;
    }
  }
  return false;
}

function pickerReady(): boolean {
  if (isPickerContext()) {
    if (blockingSpinnerIn(document.body)) {
      return false;
    }
    return pickerControlsIn(document.body);
  }
  try {
    const iframe = liveFitmentIframe() ?? fitmentIframeElement();
    const doc = iframe?.contentDocument;
    if (doc?.body) {
      if (blockingSpinnerIn(doc.body)) {
        return false;
      }
      if (pickerControlsIn(doc.body)) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  const dialog = parentFitmentDialog();
  if (!dialog || blockingSpinnerIn(dialog)) {
    return false;
  }
  return pickerControlsIn(dialog);
}

function modalIsOnScreen(): boolean {
  if (liveFitmentIframe()) {
    return true;
  }
  return Boolean(parentFitmentDialog());
}

async function callFitmentMain(request: FitmentMainRequest): Promise<FitmentMainResponse | null> {
  try {
    const response = (await browser.runtime.sendMessage(request)) as FitmentMainResponse | undefined;
    if (response && typeof response === "object") {
      return response;
    }
  } catch {
  return null;
}
  return null;
}

async function openFitmentModal(): Promise<boolean> {
  if (isPickerContext() && pickerReady()) {
    fitmentLog("Already inside fitment picker");
    return true;
  }

  await waitForEditorIdle();

  const section = findCompatibilitySection();
  if (section instanceof HTMLElement) {
    section.scrollIntoView({ block: "center", behavior: "smooth" });
    await delay(600);
  }

  fitmentLog("Expanding in-page fitmentFrame (not clicking Edit)");
  expandFitmentIframe();
  await delay(800);

  if (pickerReady()) {
    fitmentLog("Fitment picker ready after expand");
    return true;
  }

  const iframeDoc = iframeDocument();
  const addInsideFrame = iframeDoc ? findAddControlIn(iframeDoc) : null;
  if (addInsideFrame) {
    fitmentLog(
      "Clicking Add inside fitmentFrame",
      normalize(addInsideFrame.textContent || addInsideFrame.getAttribute("aria-label") || "add"),
    );
    addInsideFrame.click();
    expandFitmentIframe();
    await delay(800);
  } else {
    const wrapper = document.querySelector(".fitment-wrapper");
    if (wrapper instanceof HTMLElement) {
      fitmentLog("Clicking in-page fitment card");
      wrapper.click();
      expandFitmentIframe();
      await delay(800);
    }
  }

  const started = Date.now();
  while (Date.now() - started < 25000) {
    expandFitmentIframe();
    const status = await callFitmentMain({ type: FITMENT_MAIN_MESSAGE, action: "ready" });
    if (status?.ready || pickerReady()) {
      fitmentLog("Fitment picker ready — selecting vehicles");
      expandFitmentIframe()?.scrollIntoView({ block: "center", behavior: "smooth" });
      await delay(500);
      return true;
    }
    await delay(400);
  }

  fitmentLog("Fitment picker did not become ready");
    return false;
  }
  
async function mainSelect(field: FitmentMainField, value: string): Promise<boolean> {
  const wanted = normalize(value);
  if (!wanted) {
    return true;
  }
  fitmentLog(`Selecting ${field}`, wanted);
  const result = await callFitmentMain({
    type: FITMENT_MAIN_MESSAGE,
    action: "select",
    field,
    value: wanted,
  });
  if (!result?.ok) {
    fitmentWarn(`No ${field} option`, result?.error || wanted);
    return false;
  }
  await delay(700);
  return true;
}

async function fillViaMainWorld(
  validRows: VehicleCompatibility[],
  existingCount: number,
): Promise<FillFitmentResult | null> {
  const status = await callFitmentMain({ type: FITMENT_MAIN_MESSAGE, action: "ready" });
  if (!status?.ready) {
    return null;
  }

  expandFitmentIframe();

  fitmentLog("Clearing previous fitment via MAIN world");
  await callFitmentMain({ type: FITMENT_MAIN_MESSAGE, action: "clear" });
  await delay(600);

  const groups = groupByMakeModel(validRows);
  fitmentLog("Applying groups", `${groups.length} make/model group(s)`);
  const warnings: string[] = [];
  let filled = 0;

  for (const group of groups) {
    if (!(await mainSelect("make", group.make))) {
      warnings.push(`Failed to apply make: ${group.make}`);
      continue;
    }
    if (!(await mainSelect("model", group.model))) {
      warnings.push(`Failed to apply model: ${group.make} ${group.model}`);
      continue;
    }
    for (const year of group.years) {
      if (!(await mainSelect("year", year))) {
        warnings.push(`Failed to apply year: ${year} ${group.make} ${group.model}`);
      }
    }
    for (const trim of group.trims) {
      await mainSelect("trim", trim);
    }
    for (const engine of group.engines) {
      await mainSelect("engine", engine);
    }
    filled += group.rows.length;
  }

  if (filled === 0) {
    return fillFitmentResult({
      sectionFound: true,
      skipped: validRows.length,
      warnings: warnings.length ? warnings : ["Could not select make/model/year in the picker"],
      existingCount,
      code: "VERIFICATION_FAILED",
    });
  }

  fitmentLog("Saving fitment modal");
  await callFitmentMain({ type: FITMENT_MAIN_MESSAGE, action: "save" });
  await waitUntil(() => !modalIsOnScreen() || !pickerReady(), 8000);
  await delay(600);

  return fillFitmentResult({
    sectionFound: true,
    cleared: true,
    filled,
    skipped: validRows.length - filled,
    warnings,
    existingCount,
    code: warnings.some((warning) => warning.startsWith("Failed to apply"))
      ? "VERIFICATION_FAILED"
      : undefined,
  });
}

function openMenuOptions(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll(
      "[role='option'], [role='menuitemcheckbox'], [role='menuitem'], [role='checkbox'], .listbox-button__option, .menu__item, .filter-menu-item, label",
    ),
  ).filter((el): el is HTMLElement => el instanceof HTMLElement && isShown(el));
}

function findFilterInput(root: ParentNode): HTMLInputElement | null {
  const inputs = root.querySelectorAll("input[type='text'], input[type='search'], input:not([type])");
  for (const input of inputs) {
    if (input instanceof HTMLInputElement && isShown(input)) {
      return input;
    }
  }
  return null;
}

async function typeFilter(input: HTMLInputElement, value: string): Promise<void> {
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: value.slice(-1) }));
  await delay(250);
}

function controlShowsValue(control: HTMLElement, wanted: string): boolean {
  const text = normalize(control.textContent ?? "");
  if (optionMatches(text, wanted)) {
        return true;
      }
  return /\([1-9]\d*\s*selected\)/i.test(text);
}

async function selectDropdown(field: FitmentField, value: string): Promise<boolean> {
  const wanted = normalize(value);
  if (!wanted) {
    return true;
  }
  const root = fillRoot();
  const control = findFieldControl(field, root);
  if (!control) {
    fitmentWarn(`${field} control not found`);
    return false;
  }
  if (controlShowsValue(control, wanted)) {
    return true;
  }
  
  fitmentLog(`Opening ${field} dropdown`, wanted);
  fillRoot().scrollIntoView({ block: "center" });
  if (control.getAttribute("aria-expanded") !== "true") {
    fireClick(control);
    await delay(700);
  }

  const filter = findFilterInput(fillRoot());
  if (filter && (field === "make" || field === "model")) {
    await typeFilter(filter, wanted);
  }

  const options = openMenuOptions(fillRoot());
  for (const option of options) {
    const text = normalize(`${option.textContent || ""} ${option.getAttribute("aria-label") || ""}`);
    if (!optionMatches(text, wanted)) {
      continue;
    }
    fireClick(option);
    await delay(700);
    if (control.getAttribute("aria-expanded") === "true" && field !== "year") {
      fireClick(control);
    }
    fitmentLog(`Selected ${field}`, wanted);
          return true;
        }

  if (control instanceof HTMLSelectElement) {
    const option = Array.from(control.options).find((item) => optionMatches(item.text, wanted));
    if (option) {
      control.value = option.value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
      fitmentLog(`Selected ${field}`, wanted);
      return true;
    }
  }

  if (control.getAttribute("aria-expanded") === "true") {
    fireClick(control);
  }
  fitmentWarn(`No ${field} option`, wanted);
    return false;
  }
  
function isChromeFitmentLabel(text: string): boolean {
  return /^(select all that apply|search|filter|clear|make|model|year|trim|engine)$/i.test(
    normalize(text),
  );
}

function isSelectAllTrimLabel(text: string): boolean {
  return /select all \d+ vehicle trims|select all that apply/i.test(normalize(text));
}

function isYearMakeModelOnlyLabel(label: string, group: MakeModelGroup, year: string): boolean {
  const text = normalize(label).toLowerCase();
  const expected = normalize(`${year} ${group.make} ${group.model}`).toLowerCase();
  return text === expected;
}

function choiceRowFrom(node: HTMLElement): HTMLElement {
  return (
    node.closest("li, tr, [role='treeitem'], [role='option'], [class*='item'], label") ?? node
  );
}

function collectFitmentChoices(root: ParentNode): FitmentChoice[] {
  const choices: FitmentChoice[] = [];
  const seen = new Set<HTMLElement>();

  const consider = (node: HTMLElement, checkbox: HTMLInputElement | null, name: string): void => {
    const cleaned = normalize(name);
    if (!cleaned || isChromeFitmentLabel(cleaned) || isSelectAllTrimLabel(cleaned)) {
      return;
    }
    const row = choiceRowFrom(node);
    if (seen.has(row)) {
      return;
    }
    seen.add(row);
    choices.push({ name: cleaned, row, clickTarget: node, checkbox });
  };

  root.querySelectorAll("input[type='checkbox']").forEach((node) => {
    if (!(node instanceof HTMLInputElement) || !isShown(node)) {
      return;
    }
    const row = choiceRowFrom(node);
    consider(row, node, row.textContent || node.getAttribute("aria-label") || "");
  });

  root.querySelectorAll("[role='checkbox'], [role='treeitem'], [role='menuitemcheckbox']").forEach((node) => {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
      return;
    }
    consider(node, null, node.textContent || node.getAttribute("aria-label") || "");
  });

  return choices;
}

function trimListHeading(): HTMLElement | null {
  const nodes = fillRoot().querySelectorAll("h1, h2, h3, h4, legend, p, span, div, label, button");
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isShown(node)) {
      continue;
    }
    const text = normalize(node.textContent ?? "");
    if (text.length > 80) {
      continue;
    }
    if (/now select your vehicle trims|select all \d+ vehicle trims/i.test(text)) {
      return node;
    }
  }
  return null;
}

function trimListVisible(): boolean {
  return Boolean(trimListHeading()) || /now select your vehicle trims|select all \d+ vehicle trims/i.test(
    normalize(fillRoot().innerText ?? "").slice(0, 1500),
  );
}

function choiceIsSelected(choice: FitmentChoice): boolean {
  if (choice.checkbox?.checked) {
        return true;
      }
  return (
    choice.row.getAttribute("aria-checked") === "true" ||
    choice.clickTarget.getAttribute("aria-checked") === "true"
  );
}

async function ensureChoiceSelected(choice: FitmentChoice, selected: boolean): Promise<boolean> {
  if (choiceIsSelected(choice) === selected) {
    return true;
  }
  fireClick(choice.checkbox ?? choice.clickTarget);
  await delay(400);
  return choiceIsSelected(choice) === selected;
}

function choiceNameIsTrim(name: string, trim: string, group: MakeModelGroup, year: string): boolean {
  const text = normalize(name).toLowerCase();
  const wanted = normalize(trim).toLowerCase();
  if (!wanted || !text) {
  return false;
}
  if (isYearMakeModelOnlyLabel(name, group, year)) {
    return false;
  }
  if (text === wanted || text.includes(wanted) || wanted.includes(text)) {
    return true;
  }
  const leftover = text
    .replace(year.toLowerCase(), "")
    .replace(group.make.toLowerCase(), "")
    .replace(group.model.toLowerCase(), "")
    .replace(/\s+/g, " ")
    .trim();
  return leftover === wanted;
}

function revealNestedTrims(choice: FitmentChoice): void {
  const expanded = choice.row.getAttribute("aria-expanded");
  if (expanded === "false") {
    fireClick(choice.clickTarget);
  }
  const toggle = choice.row.querySelector("button, [aria-expanded], .expand, .arrow");
  if (toggle instanceof HTMLElement && toggle.getAttribute("aria-expanded") === "false") {
    fireClick(toggle);
  }
}

async function selectTrimsForGroup(group: MakeModelGroup): Promise<void> {
  const appeared = await waitUntil(trimListVisible, 6000);
  if (!appeared) {
    fitmentLog("No trim list appeared; years may be enough");
    return;
  }

  const root = trimListHeading()?.closest("section, form, [class*='dialog'], [class*='fitment']") ?? fillRoot();
  fitmentLog("Selecting trims", `${group.trims.join(", ") || "(all in year groups)"}`);

  for (const year of group.years) {
    const choices = collectFitmentChoices(root);
    const groupChoice = choices.find((choice) => isYearMakeModelOnlyLabel(choice.name, group, year));
    if (groupChoice) {
      revealNestedTrims(groupChoice);
      await delay(500);
    }

    const nested = collectFitmentChoices(groupChoice?.row.parentElement ?? root);
    if (group.trims.length === 0) {
      if (groupChoice && !choiceIsSelected(groupChoice)) {
        await ensureChoiceSelected(groupChoice, true);
      }
      continue;
    }

    for (const trim of group.trims) {
      const match = nested.find((choice) => choiceNameIsTrim(choice.name, trim, group, year));
      if (!match) {
        fitmentWarn("Trim not found", `${year} ${group.make} ${group.model} ${trim}`);
        continue;
      }
      await ensureChoiceSelected(match, true);
      fitmentLog("Selected trim", `${year} ${match.name}`);
    }
  }
}

async function clearPreviousFitment(): Promise<boolean> {
  const root = fillRoot();
  for (const btn of root.querySelectorAll("button")) {
    if (!(btn instanceof HTMLElement) || !isShown(btn)) {
      continue;
    }
    const text = normalize(`${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`).toLowerCase();
    if (text.includes("remove all") || text.includes("remove selected") || text.includes("clear all")) {
      fireClick(btn);
      await delay(400);
      return true;
    }
  }
  return true;
}

async function saveAndClose(): Promise<boolean> {
  const roots: ParentNode[] = [fillRoot()];
  const iframeDoc = iframeDocument();
  if (iframeDoc?.body && iframeDoc.body !== fillRoot()) {
    roots.push(iframeDoc.body);
  }

  for (const root of roots) {
    const buttons = Array.from(root.querySelectorAll("button")).filter((btn) => isShown(btn));
    for (const btn of buttons) {
      const text = normalize(`${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`).toLowerCase();
      if (
        text === "save" ||
        text === "done" ||
        text === "apply" ||
        text === "save and close" ||
        text === "apply selected"
      ) {
        fitmentLog("Saving fitment modal", text);
        fireClick(btn);
        await waitUntil(() => !modalIsOnScreen() || !pickerReady(), 8000);
        await delay(600);
        return true;
      }
    }
  }
  fitmentWarn("Save button not found");
  return false;
}

async function applyGroup(group: MakeModelGroup, warnings: string[]): Promise<number> {
  fitmentLog("Selecting make", group.make);
  if (!(await selectDropdown("make", group.make))) {
    warnings.push(`Failed to apply make: ${group.make}`);
    return 0;
  }
  await delay(500);
  await waitUntil(() => Boolean(findFieldControl("model", fillRoot())), 8000);

  fitmentLog("Selecting model", group.model);
  if (!(await selectDropdown("model", group.model))) {
    warnings.push(`Failed to apply model: ${group.make} ${group.model}`);
    return 0;
  }
  await delay(500);
  await waitUntil(() => Boolean(findFieldControl("year", fillRoot())), 8000);

  fitmentLog("Selecting years", group.years.join(", "));
  for (const year of group.years) {
    if (!(await selectDropdown("year", year))) {
      warnings.push(`Failed to apply year: ${year} ${group.make} ${group.model}`);
    }
    await delay(400);
  }

  await selectTrimsForGroup(group);

  if (group.engines.length > 0 && findFieldControl("engine", fillRoot())) {
    fitmentLog("Selecting engines", group.engines.join(", "));
    for (const engine of group.engines) {
      await selectDropdown("engine", engine);
      await delay(400);
    }
  }

  return group.rows.length;
}

async function fillInsidePicker(
  validRows: VehicleCompatibility[],
  existingCount: number,
): Promise<FillFitmentResult> {
  expandFitmentIframe();
  if (!pickerReady()) {
    const ready = await waitUntil(pickerReady, 25000);
    if (!ready) {
      return fillFitmentResult({
        sectionFound: true,
        skipped: validRows.length,
        warnings: ["FITMENT_PICKER_TIMEOUT. Make/Year controls did not appear in the picker."],
        existingCount,
        code: "FITMENT_PICKER_TIMEOUT",
      });
    }
  }

  fitmentLog("Clearing previous fitment");
  const cleared = await clearPreviousFitment();

  const groups = groupByMakeModel(validRows);
  fitmentLog("Applying groups", `${groups.length} make/model group(s)`);
  const warnings: string[] = [];
  let filled = 0;
  for (const group of groups) {
    filled += await applyGroup(group, warnings);
  }

  if (filled === 0) {
      return fillFitmentResult({
        sectionFound: true,
      cleared,
        skipped: validRows.length,
      warnings: warnings.length ? warnings : ["Could not select make/model/year in the picker"],
      existingCount,
      code: "VERIFICATION_FAILED",
    });
  }

  await saveAndClose();

      return fillFitmentResult({
        sectionFound: true,
    cleared,
    filled,
    skipped: validRows.length - filled,
    warnings,
    existingCount,
    code: warnings.some((warning) => warning.startsWith("Failed to apply"))
      ? "VERIFICATION_FAILED"
      : undefined,
  });
}

export function captureFitmentTargetEditor(): void {
  capturedExistingCount = getExistingFitmentCount();
  fitmentLog("Captured editor state", `existing=${capturedExistingCount}`);
}

export async function fillEbayListingFitment(
  rows: VehicleCompatibility[],
): Promise<FillFitmentResult> {
  const existingCount = capturedExistingCount || getExistingFitmentCount();
  fitmentLog("Starting fitment fill", `rows=${rows.length} existing=${existingCount}`);

  if (!rows.length) {
    return fillFitmentResult({
      sectionFound: Boolean(findCompatibilitySection()) || isPickerContext(),
      warnings: ["No fitment data to apply"],
      existingCount,
      code: "FITMENT_EMPTY",
    });
  }

  const validRows = rows.filter(
    (row) => normalize(row.year) && normalize(row.make) && normalize(row.model),
  );
  if (!validRows.length) {
    return fillFitmentResult({
      sectionFound: Boolean(findCompatibilitySection()) || isPickerContext(),
      skipped: rows.length,
      warnings: ["All fitment rows are incomplete"],
      existingCount,
      code: "FITMENT_EMPTY",
    });
  }

  if (!isPickerContext() && !isListingEditorStillActive()) {
    return fillFitmentResult({
      skipped: validRows.length,
      warnings: ["The listing editor is no longer active"],
      existingCount,
      code: "TARGET_EDITOR_CHANGED",
    });
  }

  if (!isPickerContext() && !findCompatibilitySection()) {
    return fillFitmentResult({
      skipped: validRows.length,
      warnings: ["Could not find compatibility section"],
      existingCount,
      code: "TARGET_EDITOR_CHANGED",
    });
  }

  try {
    if (isPickerContext()) {
      return await fillInsidePicker(validRows, existingCount);
    }

    return await persistScrapedFitment(validRows, existingCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fitmentWarn("Fitment fill error", message);
    return fillFitmentResult({
      sectionFound: true,
      skipped: validRows.length,
      warnings: [message],
      existingCount,
    });
  }
}
