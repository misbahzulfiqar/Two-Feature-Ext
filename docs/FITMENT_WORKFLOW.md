# Fitment Workflow

This document describes the vehicle compatibility (fitment) workflow only. It follows the implementation from the extension UI, through the API and scraper worker, to the target eBay listing editor.

## 1. What Fitment Means

Fitment is a list of vehicles compatible with the part being listed. Each row contains:

| Field | Required | Meaning |
| --- | --- | --- |
| `year` | Yes | Vehicle year. The normalized model requires an integer from 1900 through 2100. |
| `make` | Yes | Vehicle manufacturer. |
| `model` | Yes | Vehicle model. |
| `trim` | No | Trim, submodel, or vehicle variant. |
| `engine` | No | Engine description. |
| `notes` | No | Additional compatibility notes. |

The shared eBay model validates `year`, `make`, and `model` as non-empty fitment identity fields. `trim`, `engine`, and `notes` are optional. The extension uses string values while scraping and applying rows; the normalized model converts a valid year to a number.

The same rows are exposed under both `fitment` and `compatibility`. `compatibilityCount` is the number of rows returned after deduplication.

## 2. User Workflow

1. Open the Sell Similar panel in an active eBay listing editor.
2. Enter either an eBay US listing URL or a bare numeric eBay item ID.
3. Choose one mode:
   - **Full Scrape**: copies the normal listing fields and fitment.
   - **Fitment Only**: reads and applies vehicle compatibility only; other listing fields remain untouched.
4. Click Process Listing.
5. The extension captures the target listing's current fitment count before scraping.
6. The extension requests the source listing fitment from the background/API workflow.
7. The returned rows are normalized, deduplicated, and validated locally.
8. If rows are valid, they are applied to the target eBay editor.
9. The extension reports success only when the target application path confirms persistence or picker application.

An empty source fitment result is intentionally non-destructive. Existing target fitment is left unchanged and the result is reported as `FITMENT_EMPTY`.

## 3. Source Validation and Request

The extension accepts:

- A numeric item ID with at least six digits. It is converted to `https://www.ebay.com/itm/{id}`.
- An eBay listing URL containing `/itm/{id}`.

Only eBay US hosts are accepted for fitment scraping. Store pages, seller pages, non-eBay URLs, malformed URLs, and non-US eBay marketplaces are rejected before the scrape starts.

The request contains:

```ts
{
  listingUrl: string;
  scrapeMode: "full-scrape" | "only-fitment";
  refresh?: boolean;
}
```

The API validates the request with the shared Zod schema. It then checks maintenance mode and the corresponding feature flag. Fitment-only requests require `fitmentOnlyEnabled` to be true.

If `refresh` is false, the API can reuse a recent cached result for the same eBay item and scrape mode. The cache distinguishes `full-scrape` from `only-fitment`, because the two modes do not return the same data set. A fresh job is forced when `refresh` is true.

## 4. API and Queue Flow

1. The API checks that Redis and MongoDB are available.
2. It validates the request and feature settings.
3. It returns a reusable cached job when one is available and refresh was not requested.
4. Otherwise it creates a queued scrape record.
5. It adds a `scrape-listing` job to Redis with the listing URL, mode, requester, and correlation ID.
6. The API returns HTTP `202` with the job record.
7. The extension polls progress through HTTP while the scrape request is in flight. Fitment page progress includes the page number and accumulated row count.

The fitment-related progress stages are:

`queued` -> `worker_start` -> `source_load` -> `fitment_extract` -> `normalize` -> `target_prepare` -> `apply_fitment_media` -> `complete`

Full scrape also reports listing, media, and core-field stages. Fitment-only skips normal listing extraction and proceeds from source preparation to fitment extraction.

## 5. Worker Processing

### Full Scrape

`processListing` first fetches the normal listing fields, then calls `fetchFitment`. The fitment result replaces the listing's `fitment`, `compatibility`, and `compatibilityCount` values before normalization.

### Fitment Only

`processListing` prepares the source page and verifies that it still resembles a valid eBay listing. Ended listings, 404 pages, and pages without a recognizable title or compatibility surface return `SOURCE_NOT_FOUND`.

It then calls `fetchFitment` without extracting title, description, images, specifics, price, or other listing fields. The returned listing object contains empty values for those fields and only populated fitment/compatibility data.

## 6. Fitment Extraction Algorithm

The worker uses this decision order:

1. If no browser page is available, return a failed scrape.
2. If supplied HTML clearly has no compatibility markup, return success with zero rows without live navigation.
3. Look for a compatibility table in the current page.
4. If needed, load supplied HTML into the page and check again.
5. If the table is still missing, open the live listing.
6. Retry live navigation up to four times when eBay returns an HTTP error or an anti-bot/error page.
7. Treat four blocked attempts as a failed scrape, not as an empty fitment result.
8. Treat a successfully loaded listing with no compatibility table as a valid empty result.
9. Extract rows from the compatibility table.
10. Open the live `/itm/` listing when the current table came from an HTML snapshot, so all paginated pages can be read.
11. Follow the compatibility table's next-page control or numbered pages.
12. Wait for the first row to change before reading the next page.
13. Retry a page up to five times and stop after 100 pages.
14. Merge rows from live pages and any embedded HTML fitment chunks.
15. Deduplicate the final rows.

The worker recognizes several eBay compatibility table selectors, including the Motors compatibility table, data-testid variants, and the compatibility table wrapper. A row must contain at least year, make, and model. Whitespace and non-breaking spaces are normalized before the row is accepted.

## 7. Deduplication Rules

Rows are deduplicated by this case-insensitive key:

```text
year | make | model | trim | engine
```

Whitespace is trimmed before comparison. `notes` is not part of the identity key, so two otherwise identical vehicle rows remain one row even if their notes differ. The first retained row supplies the values that continue through the workflow.

The extension performs a second normalization and deduplication pass before applying rows. It also removes any row missing year, make, or model. Therefore the target never receives an incomplete fitment identity row.

## 8. Data Handoff to the Extension

The background/API response is converted into `VehicleCompatibility` rows. Missing properties become empty strings:

```ts
{
  year: String(row.year ?? ""),
  make: String(row.make ?? ""),
  model: String(row.model ?? ""),
  trim: String(row.trim ?? ""),
  engine: String(row.engine ?? ""),
  notes: String(row.notes ?? "")
}
```

The panel then calls `fillEbayListingFitment(rows)`. Before doing so, it records the existing target vehicle count. This count is used for diagnostics and for explaining whether the target was previously populated.

## 9. Target Context Detection

The extension supports two target contexts:

### Normal Listing Editor

The extension verifies that the listing editor is still active and that it can find the Compatibility section. If the editor changed or the section disappeared, it stops with `TARGET_EDITOR_CHANGED` instead of applying data to an unrelated page.

In this context, fitment rows are persisted directly through eBay's native `sellfit` API.

### eBay Fitment Picker / `sellfit` Frame

The extension detects the fitment iframe or a `/sellfit` page, waits for the Make and Year controls, and automates the native picker. This path is used when the native picker is already open.

## 10. Normal Listing Editor Apply Path

The direct persistence path is:

1. Read fitment frame metadata from `data-frame-meta` or nested `data-fits-meta`.
2. Resolve the listing session from metadata, or fall back to the URL's `draftId`.
3. Stop with `Missing listing session / draft id` if no session can be found.
4. Request a CSRF token from `/sellfit/api/csrf`.
5. Request fitment metadata from `/sellfit/api/metadata` using session, category, mode, features, flow, and page.
6. Read the metadata's fitment property order.
7. Build eBay's nested fitment tree for every row.
8. Request the native persist operation with the generated tree and CSRF token.
9. Return the saved count reported by eBay.

The extension does not replace eBay's native compatibility cards, reload the Compatibility iframe, or recreate a separate fitment summary. eBay remains responsible for rendering the saved result. This avoids stale counts and spinner states.

### Nested Tree Rules

The metadata controls the property order, for example Make, Model, Year, Trim, and Engine. Each row is converted into that order. Optional values are read as follows:

- `submodel` is treated as `trim`.
- Unknown metadata properties are ignored.
- The path stops at the first empty value. Later values are not shifted upward into an earlier level.
- Paths shorter than three values are dropped because they do not have the required make/model/year identity.
- A leaf is stored as `[true, 1, notesOrNull]`.

Stopping at the first missing level is important. For example, a missing Trim with an Engine present must not place the Engine at the Trim level and create an invalid eBay tree.

## 11. Native Picker Apply Path

When the picker is open, the extension:

1. Waits up to 25 seconds for the picker controls and for blocking spinners to clear.
2. Clears existing selected fitment using the picker's Remove/Clear controls.
3. Groups rows by case-insensitive Make + Model.
4. Collects unique years, trims, and engines for each group.
5. Selects the Make.
6. Waits for the Model control and selects the Model.
7. Selects each group year.
8. Expands the trim list when present and selects matching trims for each year.
9. Selects engines when an Engine control exists.
10. Clicks Save, Done, Apply, Save and Close, or Apply Selected.
11. Waits for the picker to close or stop being ready.

Option matching is normalized and case-insensitive. It accepts exact matches and contained text matches, but deliberately ignores sorting labels, Select All labels, and unrelated picker labels. Trim selection also excludes the year/make/model group heading so the heading is not mistaken for a trim.

The result counts rows represented by successfully processed Make/Model groups. Warnings are retained when an individual make, model, year, or trim cannot be applied.

## 12. Empty, Partial, and Failure Behavior

| Code / condition | Behavior |
| --- | --- |
| `FITMENT_EMPTY` | No usable rows, or all rows are incomplete. No target replacement occurs. Existing target fitment remains. |
| `TARGET_EDITOR_CHANGED` | The listing editor or Compatibility section is no longer available. Application stops before replacing target data. |
| `FITMENT_PICKER_TIMEOUT` | Picker controls did not become ready within 25 seconds. Existing target data is not reported as successfully replaced. |
| `VERIFICATION_FAILED` | eBay persistence failed, a required picker option was missing, or not all rows were applied. The result includes warnings and applied/skipped counts. |
| Source blocked | eBay returned block/error pages for all four live attempts. The scrape fails and is not converted into zero fitment rows. |
| No compatibility table | The listing loaded normally but has no fitment table. Scrape succeeds with zero rows; the target remains unchanged. |
| Missing session | Direct persistence stops because the target draft/session cannot be identified. |

The panel displays a success message only when all requested rows are applied with no skipped rows and no warnings. A partial application is reported as verification failure, even when some rows were applied.

## 13. Clear Fitment Workflow

The Clear Form action only clears fields selected in the options menu. If Fitment is selected:

1. The extension reads the target fitment session metadata.
2. It sends a `clear-all` fitment message to the main world.
3. The main-world function calls eBay's native clear/persist path.
4. The extension reports the number cleared.

The source URL remains in the panel so the same source can be processed again. Item category and condition are intentionally left unchanged because eBay requires them.

## 14. Message and Execution Boundaries

Fitment uses the message type `SELL_SIMILAR_FITMENT_MAIN` for main-world operations:

| Action | Purpose |
| --- | --- |
| `guard` | Check or prepare the fitment frame. Current guard is intentionally a no-op. |
| `ready` | Inspect whether picker controls are ready. |
| `select` | Select one Make, Model, Year, Trim, or Engine value. |
| `clear` | Clear picker selections. |
| `save` | Save picker selections. |
| `persist` | Persist rows through eBay's native API. |
| `clear-all` | Remove all saved target vehicles through eBay's native API. |

The background service worker locates `/sellfit` frames and injects main-world functions into them. Direct persistence targets the tab main world because it needs the target editor's session and eBay page context.

## 15. History and Progress

After applying a scrape, the extension reports fitment count, image count, warning count, and warnings to the API when a job ID exists. History and admin views classify `only-fitment` jobs separately from full scrapes and display the saved fitment count.

Progress is best effort and must not interrupt scraping. If progress polling fails, the scrape continues and the final response remains authoritative.

## 16. Operational Checklist

For a successful fitment-only run, verify:

1. The source is an eBay US `/itm/` listing or valid item ID.
2. Redis and MongoDB are available for queued scraping.
3. Fitment-only is enabled in admin settings.
4. The source listing has a real compatibility table, or valid embedded compatibility markup.
5. The worker is not continuously blocked by eBay anti-bot pages.
6. The target remains on the eBay listing editor while the scrape runs.
7. The target has a readable fitment session or draft ID.
8. The returned rows contain year, make, and model.
9. eBay's fitment metadata is available when using direct persistence.
10. The final result has `filled === requested`, `skipped === 0`, and no warnings.

## 17. Source Ownership Map

- Shared fitment model: `packages/ebay-models/src/fitment.ts`
- Shared row and scrape contracts: `packages/contracts/src/scrape.ts`
- Request/job validation: `packages/validation/src/jobs.ts` and `packages/validation/src/scrape.ts`
- API feature checks and job enqueue: `apps/api/src/controllers/ScrapeJobsController.ts`
- Source extraction and pagination: `apps/scraper-worker/src/controllers/FetchFitment.js`
- Mode branching: `apps/scraper-worker/src/processListing.js`
- Source URL conversion and response mapping: `apps/extension/lib/scrape-source-title.ts`
- Target normalization and apply workflow: `apps/extension/lib/fill-ebay-fitment.ts`
- Main-world eBay persistence: `apps/extension/lib/fitment-main-world.ts`
- Background frame injection and message routing: `apps/extension/entrypoints/background.ts`
- Fitment result codes: `apps/extension/lib/fill-fitment-messages.ts`

## 18. Complete Fitment Code Appendix

The complete current implementation is maintained in the source files below. The links are the authoritative code; this appendix avoids copying large files into documentation and then allowing the copies to become stale. Every fitment-related source file is included, grouped by workflow responsibility.

### Shared Models and Contracts

- [packages/ebay-models/src/fitment.ts](../packages/ebay-models/src/fitment.ts)
  - `vehicleFitmentSchema`
  - `normalizedListingSchema`
  - `VehicleFitment`
  - `NormalizedListing`
  - `normalizeFitment`
- [packages/ebay-models/src/scraped-listings.ts](../packages/ebay-models/src/scraped-listings.ts)
  - normalized listing shape and fitment/compatibility conversion
- [packages/ebay-models/src/scrape-job-store.ts](../packages/ebay-models/src/scrape-job-store.ts)
  - persisted `fitmentCount` job field and scrape summaries
- [packages/contracts/src/scrape.ts](../packages/contracts/src/scrape.ts)
  - `SCRAPE_MODES`
  - `VehicleCompatibility`
  - `ScrapedListingData`
  - fitment progress fields and stages
- [packages/contracts/src/jobs.ts](../packages/contracts/src/jobs.ts)
  - `refresh-fitment` job name and job payload types
- [packages/validation/src/scrape.ts](../packages/validation/src/scrape.ts)
  - request validation for listing URL, mode, and refresh
- [packages/validation/src/jobs.ts](../packages/validation/src/jobs.ts)
  - queued scrape and `refresh-fitment` payload validation

### API, Records, Cache, and Scheduled Refresh

- [apps/api/src/controllers/ScrapeJobsController.ts](../apps/api/src/controllers/ScrapeJobsController.ts)
  - validates fitment-only requests
  - checks `fitmentOnlyEnabled`
  - separates cached full-scrape and fitment-only jobs
  - creates and queues scrape records
- [apps/api/src/scrape-cache.ts](../apps/api/src/scrape-cache.ts)
  - cache identity includes scrape mode so fitment-only results do not collide with full results
- [apps/api/src/scrape-records.ts](../apps/api/src/scrape-records.ts)
  - persists and reports `fitmentCount`
  - formats fitment-only job history
- [apps/api/src/controllers/FetchFitment.js](../apps/api/src/controllers/FetchFitment.js)
  - compatibility fetch controller export used by the API-side controller surface
- [apps/api/src/admin/types.ts](../apps/api/src/admin/types.ts)
  - default feature flags including `fitmentOnlyEnabled`
- [apps/api/src/admin/handlers.ts](../apps/api/src/admin/handlers.ts)
  - admin settings, filtering, and fitment-only statistics
- [apps/cron/src/index.ts](../apps/cron/src/index.ts)
  - schedules the `refresh-fitment` job

### Scraper Worker

- [apps/scraper-worker/src/controllers/FetchFitment.js](../apps/scraper-worker/src/controllers/FetchFitment.js)
  - table detection
  - row extraction and whitespace cleanup
  - duplicate removal
  - live-listing fallback
  - anti-bot retry handling
  - compatibility pagination
  - embedded HTML chunk extraction
  - `fetchFitment`
- [apps/scraper-worker/src/processListing.js](../apps/scraper-worker/src/processListing.js)
  - full-scrape and only-fitment branches
  - `applyFitment`
  - source-not-found handling for fitment-only mode
- [apps/scraper-worker/src/run-scrape.ts](../apps/scraper-worker/src/run-scrape.ts)
  - worker execution and fitment page progress callback
- [apps/scraper-worker/src/scrape-progress-store.ts](../apps/scraper-worker/src/scrape-progress-store.ts)
  - current fitment page and accumulated fitment row progress
- [apps/scraper-worker/src/scrape-http.ts](../apps/scraper-worker/src/scrape-http.ts)
  - fitment progress HTTP response surface
- [apps/scraper-worker/src/block-resources.ts](../apps/scraper-worker/src/block-resources.ts)
  - resource filtering used while scraping compatibility data
- [apps/scraper-worker/src/controllers/FetchEbayListing.js](../apps/scraper-worker/src/controllers/FetchEbayListing.js)
  - listing page preparation and compatibility data passed into processing

### Extension Source and Target Apply Logic

- [apps/extension/lib/scrape-source-title.ts](../apps/extension/lib/scrape-source-title.ts)
  - source URL/item ID validation
  - US marketplace restriction
  - response mapping into `VehicleCompatibility`
  - progress polling
  - apply-result reporting
- [apps/extension/lib/fill-ebay-fitment.ts](../apps/extension/lib/fill-ebay-fitment.ts)
  - row normalization and deduplication
  - target context detection
  - existing-count capture
  - direct persistence dispatch
  - native picker automation
  - make/model grouping
  - year, trim, and engine selection
  - save and clear behavior
- [apps/extension/lib/fitment-main-world.ts](../apps/extension/lib/fitment-main-world.ts)
  - main-world request types and validation
  - fitment metadata parsing
  - eBay nested tree construction
  - CSRF and metadata requests
  - native `/sellfit/api/persist` calls
  - existing-tree replacement and restoration
  - persist response verification
  - clear-all persistence
- [apps/extension/lib/fill-fitment-messages.ts](../apps/extension/lib/fill-fitment-messages.ts)
  - fitment broadcast/request/result message names
  - `FillFitmentResult`
  - `FITMENT_EMPTY`
  - `TARGET_EDITOR_CHANGED`
  - `FITMENT_PICKER_TIMEOUT`
  - `VERIFICATION_FAILED`
- [apps/extension/lib/fitment-debug.ts](../apps/extension/lib/fitment-debug.ts)
  - fitment logging and warning helpers
- [apps/extension/entrypoints/background.ts](../apps/extension/entrypoints/background.ts)
  - `/sellfit` frame discovery
  - main-world script injection
  - routing for `guard`, `ready`, `select`, `clear`, `save`, `persist`, and `clear-all`
- [apps/extension/components/SellSimilarAssistant.tsx](../apps/extension/components/SellSimilarAssistant.tsx)
  - mode selection
  - fitment target capture
  - scrape progress and apply orchestration
  - user-facing fitment result messages
- [apps/extension/components/scrape-mode.ts](../apps/extension/components/scrape-mode.ts)
  - available scrape modes
- [apps/extension/components/fill-options.ts](../apps/extension/components/fill-options.ts)
  - fitment field selection in Clear Form options
- [apps/extension/lib/clear-listing-fields.ts](../apps/extension/lib/clear-listing-fields.ts)
  - dispatches fitment clear operations
- [apps/extension/lib/restore-listing-page.ts](../apps/extension/lib/restore-listing-page.ts)
  - preserves the target listing page around fitment application
- [apps/extension/lib/restore-listing-page-main.ts](../apps/extension/lib/restore-listing-page-main.ts)
  - main-world page restoration selectors, including fitment surfaces

### Fitment-Facing UI and Documentation

- [apps/extension/components/ScrapeModeSelect.tsx](../apps/extension/components/ScrapeModeSelect.tsx)
  - Full Scrape and Fitment Only selector
- [apps/extension/components/SellSimilarAssistant.css](../apps/extension/components/SellSimilarAssistant.css)
  - fitment status, picker, and verification presentation styles
- [apps/web/src/pages/HelpPage.tsx](../apps/web/src/pages/HelpPage.tsx)
  - public Fitment Only explanation
- [apps/web/src/pages/HowToUsePage.tsx](../apps/web/src/pages/HowToUsePage.tsx)
  - public mode-selection workflow
- [apps/web/src/pages/HistoryPage.tsx](../apps/web/src/pages/HistoryPage.tsx)
  - Fitment Only history filter
- [apps/web/src/pages/HistoryJobPage.tsx](../apps/web/src/pages/HistoryJobPage.tsx)
  - fitment count in job details
- [apps/admin/src/pages/admin/AdminJobsPage.tsx](../apps/admin/src/pages/admin/AdminJobsPage.tsx)
  - admin Fitment Only job filter
- [apps/admin/src/pages/admin/AdminSettingsPage.tsx](../apps/admin/src/pages/admin/AdminSettingsPage.tsx)
  - fitment-only feature toggle
- [apps/admin/src/pages/admin/AdminJobDetailsPage.tsx](../apps/admin/src/pages/admin/AdminJobDetailsPage.tsx)
  - fitment record summary in admin job details
- [apps/admin/src/pages/admin/AdminUserDetailsPage.tsx](../apps/admin/src/pages/admin/AdminUserDetailsPage.tsx)
  - fitment-only user statistics

### Generated Code

The repository also contains generated `dist` and extension `.output` copies of several fitment modules. They are build artifacts, not separate implementations. They must be regenerated from the source files above and should not be edited directly.

## 19. Fitment-Only Scraping Code

The following code is the fitment scraping path only. The linked source files are authoritative.

### Request and Row Contracts

Source: [packages/validation/src/scrape.ts](../packages/validation/src/scrape.ts)

```ts
function isEbayItemUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return parsed.hostname.toLowerCase().includes("ebay.") &&
      (path === "/itm" || path.startsWith("/itm/"));
  } catch {
    return false;
  }
}

export const scrapeListingRequestSchema = z.object({
  listingUrl: z.string().url().refine(
    isEbayItemUrl,
    "Source URL must be an eBay item listing (/itm/...)",
  ),
  html: z.string().min(1).optional(),
  scrapeMode: z.enum(["full-scrape", "only-fitment"]).optional(),
  refresh: z.boolean().optional(),
});

export const vehicleCompatibilitySchema = z.object({
  year: z.string(),
  make: z.string(),
  model: z.string(),
  trim: z.string().optional().default(""),
  engine: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const scrapedListingDataSchema = z.object({
  fitment: z.array(vehicleCompatibilitySchema).default([]),
  compatibility: z.array(vehicleCompatibilitySchema).default([]),
  compatibilityCount: z.number().int().nonnegative().default(0),
});
```

Source: [packages/contracts/src/scrape.ts](../packages/contracts/src/scrape.ts)

```ts
export const SCRAPE_MODES = ["full-scrape", "only-fitment"] as const;
export type ScrapeMode = (typeof SCRAPE_MODES)[number];

export type VehicleCompatibility = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  notes: string;
};

export type ScrapedListingData = {
  // Other listing fields are present for the shared response shape.
  fitment: VehicleCompatibility[];
  compatibility: VehicleCompatibility[];
  compatibilityCount: number;
};
```

### Main Worker Entry Point

Source: [apps/scraper-worker/src/controllers/FetchFitment.js](../apps/scraper-worker/src/controllers/FetchFitment.js)

```js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rowKey(row) {
  return [row.year, row.make, row.model, row.trim, row.engine]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function uniqueRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = rowKey(row);
    if (!key || seen.has(key)) continue;
    seen.set(key, row);
  }
  return [...seen.values()];
}

function listingHasFitmentMarkup(html) {
  if (!html || typeof html !== "string") return false;
  return /motors-compatibility-table|d-motors-compatibility-table|d-item-compatibility|compatible vehicles/i.test(html);
}

async function hasCompatibilityTable(page) {
  return page.evaluate(() => Boolean(
    document.querySelector(".motors-compatibility-table") ||
    document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
    document.querySelector(".motors-compatibility-table-wrapper") ||
    document.querySelector('[data-testid="d-item-compatibility"] table'),
  ));
}

export async function fetchFitment(page, listingUrl, options = {}) {
  const onProgress = typeof options.onFitmentProgress === "function"
    ? options.onFitmentProgress
    : null;
  const html = typeof options.html === "string" ? options.html : "";

  try {
    if (!page) {
      return { success: false, compatibility: [], compatibilityCount: 0,
        error: "Browser page is not available" };
    }

    if (html && !listingHasFitmentMarkup(html)) {
      return { success: true, compatibility: [], compatibilityCount: 0 };
    }

    let tableFound = await hasCompatibilityTable(page).catch(() => false);
    if (!tableFound && html) {
      try {
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
        tableFound = await hasCompatibilityTable(page);
      } catch {
        tableFound = false;
      }
    }

    if (!tableFound) {
      const liveStatus = await openLiveListing(page, listingUrl).catch(() => "no-table");
      if (liveStatus === "blocked") {
        return {
          success: false,
          compatibility: [],
          compatibilityCount: 0,
          blocked: true,
          error: "eBay blocked the scraper after 4 attempts. Try again in a moment.",
        };
      }
      tableFound = liveStatus === "ok";
    }

    if (!tableFound) {
      return { success: true, compatibility: [], compatibilityCount: 0 };
    }

    let rows = [];
    const onLiveListing = /\/itm\//i.test(page.url());
    if (onLiveListing) {
      rows = await handlePagination(page, onProgress);
    } else {
      const opened = (await openLiveListing(page, listingUrl)) === "ok";
      rows = opened
        ? await handlePagination(page, onProgress)
        : (await extractCompatibilityData(page)).compatibility;
    }

    if (html) {
      rows = uniqueRows([...rows, ...(await extractRowsFromHtmlChunks(page, html))]);
    } else {
      rows = uniqueRows(rows);
    }

    return { success: true, compatibility: rows, compatibilityCount: rows.length };
  } catch (error) {
    return {
      success: false,
      compatibility: [],
      compatibilityCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Table Row Extraction

The complete extraction helpers are in [FetchFitment.js](../apps/scraper-worker/src/controllers/FetchFitment.js), including `extractCompatibilityData`, `extractRowsFromHtmlChunks`, `rowKey`, `uniqueRows`, and `listingHasFitmentMarkup`.

```js
async function extractCompatibilityData(page) {
  return page.evaluate(() => {
    const clean = (text) => String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const result = { compatibility: [], compatibilityCount: 0 };
    const table = document.querySelector(".motors-compatibility-table") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
      document.querySelector('[data-testid="d-item-compatibility"] table') ||
      document.querySelector(".motors-compatibility-table-wrapper table") ||
      document.querySelector(".vim.d-motors-compatibility-table table");

    if (!table) return result;
    const details = table.querySelector(".motors-compatibility-table__details-text") ||
      document.querySelector(".motors-compatibility-table__details-text");
    const countMatch = details?.textContent?.match(/\d+/);
    result.compatibilityCount = countMatch ? Number.parseInt(countMatch[0], 10) : 0;

    const seen = new Set();
    table.querySelectorAll("tbody.ux-table-section__body tr, tbody tr").forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 3) return;
      const entry = {
        year: clean(cells[0]?.textContent),
        make: clean(cells[1]?.textContent),
        model: clean(cells[2]?.textContent),
        trim: clean(cells[3]?.textContent),
        engine: clean(cells[4]?.textContent),
        notes: clean(cells[5]?.textContent),
      };
      if (!entry.year || !entry.make || !entry.model) return;
      const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}|${entry.engine}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.compatibility.push(entry);
    });

    if (!result.compatibilityCount) result.compatibilityCount = result.compatibility.length;
    return result;
  });
}
```

### Live Navigation, Blocking Detection, and Pagination

All functions are in [FetchFitment.js](../apps/scraper-worker/src/controllers/FetchFitment.js): `isBlockedPage`, `openLiveListing`, `readFitmentPaginationState`, `firstFitmentRowText`, `clickNextFitmentPage`, and `handlePagination`.

```js
const LIVE_NAV_ATTEMPTS = 4;

async function openLiveListing(page, listingUrl) {
  const selectors = [
    ".motors-compatibility-table",
    '[data-testid="d-motors-compatibility-table"]',
    '[data-testid="d-item-compatibility"]',
    ".motors-compatibility-table-wrapper",
  ];
  let blockedEveryTime = true;

  for (let attempt = 1; attempt <= LIVE_NAV_ATTEMPTS; attempt += 1) {
    try {
      const response = await page.goto(listingUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
        referer: "https://www.ebay.com/",
      });
      const status = response ? response.status() : 0;
      if (status >= 400 || await isBlockedPage(page)) {
        await sleep(1500 * attempt + Math.floor(Math.random() * 700));
        continue;
      }
      blockedEveryTime = false;
      try {
        await Promise.race(selectors.map((selector) =>
          page.waitForSelector(selector, { timeout: 20000 })));
        return "ok";
      } catch {
        return "no-table";
      }
    } catch {
      await sleep(1500 * attempt);
    }
  }
  return blockedEveryTime ? "blocked" : "no-table";
}

async function handlePagination(page, onProgress) {
  let allCompatibility = [];
  let currentPage = 1;
  let retryCount = 0;
  while (currentPage <= 100 && retryCount < 5) {
    try {
      await Promise.race([
        ".motors-compatibility-table",
        '[data-testid="d-motors-compatibility-table"]',
        ".motors-compatibility-table-wrapper",
        '[data-testid="d-item-compatibility"]',
      ].map((selector) => page.waitForSelector(selector, { timeout: 30000 })));

      const pageData = await extractCompatibilityData(page);
      const state = await readFitmentPaginationState(page);
      allCompatibility = uniqueRows(allCompatibility.concat(pageData.compatibility));
      await onProgress?.(
        currentPage,
        allCompatibility.length,
        `Scraped page ${currentPage} — ${allCompatibility.length} vehicles found so far`,
      );

      if (!state.hasNext && state.pageLinkCount <= currentPage) break;
      const previousFirstRow = await firstFitmentRowText(page);
      if (!await clickNextFitmentPage(page)) break;
      currentPage += 1;
      await page.waitForFunction((previous) => {
        const row = document.querySelector(
          ".motors-compatibility-table tbody tr, [data-testid=\"d-motors-compatibility-table\"] tbody tr, .motors-compatibility-table-wrapper tbody tr, [data-testid=\"d-item-compatibility\"] tbody tr",
        );
        return Boolean(row) && row.textContent.trim() !== previous;
      }, { timeout: 30000 }, previousFirstRow);
      await sleep(250);
      retryCount = 0;
    } catch {
      retryCount += 1;
      if (retryCount < 5) await sleep(3000);
    }
  }
  return uniqueRows(allCompatibility);
}
```

### Fitment-Only Mode Orchestration

Source: [apps/scraper-worker/src/processListing.js](../apps/scraper-worker/src/processListing.js)

```js
case "only-fitment": {
  await prepareListingPage(page, listingUrl, options);
  const sourceOk = await page.evaluate(() => {
    const text = (document.body?.innerText || "").slice(0, 2500);
    if (/this listing was ended|we looked everywhere|page not found|error 404/i.test(text)) {
      return false;
    }
    return Boolean(document.querySelector(
      'h1[data-testid="x-item-title-label"], .x-item-title__mainTitle, h1[itemprop="name"], .motors-compatibility-table, [data-testid="d-motors-compatibility-table"], [data-testid="d-item-compatibility"]',
    ));
  });
  if (!sourceOk) {
    return { status: "failed", code: "404", message: "SOURCE_NOT_FOUND", listingData };
  }

  await onProgress("fitment_extract");
  const fitmentResult = await fetchFitment(page, listingUrl, options);
  applyFitment(listingData, fitmentResult);
  await onProgress("normalize");
  return { status: "ok", code: "200", listingData };
}
```

Source: [apps/scraper-worker/src/run-scrape.ts](../apps/scraper-worker/src/run-scrape.ts)

```ts
export async function runScrape(env, listingUrl, options = {}) {
  const run = scrapeQueue.then(async () => withPage(env, async (page, resourceStats) => {
    try {
      await options.onProgress?.("source_load");
      return await processListing(page, listingUrl, options);
    } finally {
      console.log(
        `[runScrape] finished | requests allowed=${resourceStats.allowed} blocked=${resourceStats.blocked}`,
      );
    }
  }));
  scrapeQueue = run.then(() => undefined, () => undefined);
  return run;
}
```

### Progress Functions

Source: [apps/scraper-worker/src/scrape-progress-store.ts](../apps/scraper-worker/src/scrape-progress-store.ts)

```ts
export function setFitmentProgress(page: number, rows: number, message: string): void {
  current = {
    ...current,
    active: true,
    stage: "fitment_extract",
    fitmentPage: page,
    fitmentRows: rows,
    message: message || `Reading vehicle compatibility, page ${page} (${rows} so far)`,
    updatedAt: Date.now(),
  };
}

export function readScrapeProgress(): ScrapeProgressSnapshot {
  return current;
}
```

Source: [apps/scraper-worker/src/scrape-http.ts](../apps/scraper-worker/src/scrape-http.ts)

```ts
if (req.method === "GET" && path === "/scrape/progress") {
  sendJson(res, 200, readScrapeProgress());
  return;
}

result = await runScrape(env, parsed.data.listingUrl, {
  html: parsed.data.html,
  scrapeMode: parsed.data.scrapeMode,
  onProgress: (stage) => setScrapeStage(stage),
  onFitmentProgress: (page, rows, message) =>
    setFitmentProgress(page, rows, message),
});
```

### API Enqueue and Extension Handoff

Sources:

- [apps/api/src/controllers/ScrapeJobsController.ts](../apps/api/src/controllers/ScrapeJobsController.ts)
- [apps/extension/lib/scrape-source-title.ts](../apps/extension/lib/scrape-source-title.ts)

```ts
const scrapeMode = parsed.data.scrapeMode ?? "full-scrape";
if (scrapeMode === "only-fitment" && !settings.features.fitmentOnlyEnabled) {
  return res.status(403).json({
    ok: false,
    error: { code: "FEATURE_DISABLED", message: "Fitment-only scrape is disabled" },
  });
}

await queue.add("scrape-listing", {
  listingUrl: parsed.data.listingUrl,
  scrapeMode,
  requestedBy: actor.userId,
  correlationId: correlationId(req),
});
```

```ts
export async function scrapeSourceListing(
  source: string,
  scrapeMode: ScrapeMode = "full-scrape",
): Promise<ScrapedListing> {
  const listingUrl = resolveSourceListingUrl(source);
  const response = await browser.runtime.sendMessage({
    type: SCRAPE_LISTING,
    listingUrl,
    scrapeMode,
  });
  if (!response?.ok) throw new Error(response?.error || "Couldn't scrape listing");
  return { ...toScrapedListing(response.data), jobId: response.jobId };
}
```