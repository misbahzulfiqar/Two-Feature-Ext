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
    if (!key || seen.has(key)) {
      continue;
    }
    seen.set(key, row);
  }
  return [...seen.values()];
}

function extraHtmlChunks(html) {
  if (!html || typeof html !== "string") {
    return [];
  }
  const marker = "<!--SELL_SIMILAR_FITMENT";
  const index = html.indexOf(marker);
  if (index < 0) {
    return [];
  }
  return html
    .slice(index)
    .split(/<!--SELL_SIMILAR_FITMENT_PAGES?-->/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.includes("<") && /year/i.test(chunk) && /make/i.test(chunk));
}

async function extractCompatibilityData(page) {
  return page.evaluate(() => {
    const clean = (text) =>
      String(text || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const result = {
      compatibility: [],
      compatibilityCount: 0,
    };

    const motorsTable =
      document.querySelector(".motors-compatibility-table") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
      document.querySelector('[data-testid="d-item-compatibility"] table') ||
      document.querySelector(".motors-compatibility-table-wrapper table") ||
      document.querySelector(".vim.d-motors-compatibility-table table");

    if (!motorsTable) {
      return result;
    }

    const detailsTextEl =
      motorsTable.querySelector(".motors-compatibility-table__details-text") ||
      document.querySelector(".motors-compatibility-table__details-text");
    const detailsText = detailsTextEl?.textContent;
    if (detailsText) {
      const countMatch = detailsText.match(/\d+/);
      result.compatibilityCount = countMatch ? Number.parseInt(countMatch[0], 10) : 0;
    }

    const rows = Array.from(
      motorsTable.querySelectorAll("tbody.ux-table-section__body tr, tbody tr"),
    );
    const seen = new Set();
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 3) {
        return;
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
        return;
      }
      const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}|${entry.engine}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      result.compatibility.push(entry);
    });

    if (!result.compatibilityCount && result.compatibility.length > 0) {
      result.compatibilityCount = result.compatibility.length;
    }

    return result;
  });
}

async function hasCompatibilityTable(page) {
  return page.evaluate(
    () =>
      Boolean(
        document.querySelector(".motors-compatibility-table") ||
          document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
          document.querySelector(".motors-compatibility-table-wrapper") ||
          document.querySelector('[data-testid="d-item-compatibility"] table'),
      ),
  );
}

async function readFitmentPaginationState(page) {
  return page.evaluate(() => {
    const root =
      document.querySelector(".motors-compatibility-table") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
      document.querySelector('[data-testid="d-item-compatibility"]') ||
      document.querySelector(".motors-compatibility-table-wrapper");
    const scope = root || document.body;
    const hay = `${scope.textContent || ""} ${document.body?.innerText || ""}`.slice(0, 8000);
    const advertisedMatch =
      hay.match(/compatible with\s+(\d+)\s+vehicle/i) ||
      hay.match(/(\d+)\s+vehicle\(s\)/i) ||
      hay.match(/of\s+(\d+)\s+vehicle/i);
    const advertisedCount = advertisedMatch ? Number.parseInt(advertisedMatch[1], 10) : 0;

    const disabled = (el) =>
      !el ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("disabled") ||
      /disabled|pagination__next--disabled/i.test(el.className || "");

    const next =
      scope.querySelector(".pagination__next") ||
      scope.querySelector('[aria-label*="Go to next" i]') ||
      scope.querySelector('[aria-label*="Next page" i]') ||
      scope.querySelector('a[rel="next"]');

    const pageNumbers = Array.from(scope.querySelectorAll("a, button"))
      .map((el) => (el.textContent || "").trim())
      .filter((text) => /^\d+$/.test(text));

    return {
      advertisedCount: Number.isFinite(advertisedCount) ? advertisedCount : 0,
      hasNext: Boolean(next) && !disabled(next),
      pageLinkCount: new Set(pageNumbers).size,
    };
  });
}

async function firstFitmentRowText(page) {
  return page.evaluate(() => {
    const firstRow =
      document.querySelector(".motors-compatibility-table tbody.ux-table-section__body tr") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"] tbody tr') ||
      document.querySelector(".motors-compatibility-table-wrapper tbody tr") ||
      document.querySelector('[data-testid="d-item-compatibility"] tbody tr');
    return firstRow ? firstRow.textContent.trim() : "";
  });
}

async function clickNextFitmentPage(page) {
  return page.evaluate(() => {
    const root =
      document.querySelector(".motors-compatibility-table") ||
      document.querySelector('[data-testid="d-motors-compatibility-table"]') ||
      document.querySelector('[data-testid="d-item-compatibility"]') ||
      document.querySelector(".motors-compatibility-table-wrapper");
    if (!root) {
      return false;
    }

    const disabled = (el) =>
      !el ||
      el.getAttribute("aria-disabled") === "true" ||
      el.hasAttribute("disabled") ||
      /disabled|pagination__next--disabled/i.test(el.className || "");

    const next =
      root.querySelector(".pagination__next") ||
      root.querySelector('[aria-label*="Go to next" i]') ||
      root.querySelector('[aria-label*="Next page" i]') ||
      root.querySelector('a[rel="next"]');
    if (next instanceof HTMLElement && !disabled(next)) {
      next.click();
      return true;
    }

    const current = root.querySelector('[aria-current="page"]');
    const currentNum = Number.parseInt((current?.textContent || "").trim(), 10) || 1;
    const wanted = String(currentNum + 1);
    const pageLink = Array.from(root.querySelectorAll("a, button")).find(
      (el) => (el.textContent || "").trim() === wanted,
    );
    if (pageLink instanceof HTMLElement && !disabled(pageLink)) {
      pageLink.click();
      return true;
    }
    return false;
  });
}

async function handlePagination(page, onProgress) {
  let allCompatibility = [];
  let currentPage = 1;
  let retryCount = 0;
  const maxRetries = 5;
  const maxPages = 100;
  const tableSelectors = [
    ".motors-compatibility-table",
    '[data-testid="d-motors-compatibility-table"]',
    ".motors-compatibility-table-wrapper",
    '[data-testid="d-item-compatibility"]',
  ];

  while (currentPage <= maxPages && retryCount < maxRetries) {
    try {
      await Promise.race(
        tableSelectors.map((selector) => page.waitForSelector(selector, { timeout: 30000 })),
      );

      const pageStartedAt = Date.now();
      const pageData = await extractCompatibilityData(page);
      const state = await readFitmentPaginationState(page);
      allCompatibility = uniqueRows(allCompatibility.concat(pageData.compatibility));
      console.log(
        `[FetchFitment] Page ${currentPage}: extracted ${pageData.compatibility.length} rows in ${Date.now() - pageStartedAt}ms (total: ${allCompatibility.length}${state.advertisedCount ? ` of ${state.advertisedCount}` : ""})`,
      );
      if (onProgress) {
        await onProgress(
          currentPage,
          allCompatibility.length,
          `Scraped page ${currentPage} — ${allCompatibility.length} vehicles found so far`,
        );
      }

      const moreNumberedPages = state.pageLinkCount > currentPage;
      if (!state.hasNext && !moreNumberedPages) {
        break;
      }

      const firstRowTextBefore = await firstFitmentRowText(page);
      const clicked = await clickNextFitmentPage(page);
      if (!clicked) {
        console.log("[FetchFitment] No next compatibility page control");
        break;
      }

      currentPage += 1;
      console.log(`[FetchFitment] Navigating to page ${currentPage}...`);

      await page.waitForFunction(
        (prevFirstRowText) => {
          const firstRow =
            document.querySelector(".motors-compatibility-table tbody.ux-table-section__body tr") ||
            document.querySelector('[data-testid="d-motors-compatibility-table"] tbody tr') ||
            document.querySelector(".motors-compatibility-table-wrapper tbody tr") ||
            document.querySelector('[data-testid="d-item-compatibility"] tbody tr');
          if (!firstRow) {
            return false;
          }
          return firstRow.textContent.trim() !== prevFirstRowText;
        },
        { timeout: 30000 },
        firstRowTextBefore,
      );

      await sleep(250);
      retryCount = 0;
    } catch (error) {
      console.log(`[FetchFitment] Error on page ${currentPage}: ${error.message}`);
      retryCount += 1;
      if (retryCount < maxRetries) {
        console.log(
          `[FetchFitment] Retrying page ${currentPage} (attempt ${retryCount}/${maxRetries})`,
        );
        await sleep(3000);
      } else {
        console.log(
          `[FetchFitment] Max retries reached for page ${currentPage}. Returning ${allCompatibility.length} rows.`,
        );
        break;
      }
    }
  }

  return uniqueRows(allCompatibility);
}

async function extractRowsFromHtmlChunks(page, html) {
  const rows = [];
  for (const chunk of extraHtmlChunks(html)) {
    const parsed = await page.evaluate((source) => {
      const clean = (text) =>
        String(text || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const doc = new DOMParser().parseFromString(source, "text/html");
      const results = [];
      const table =
        doc.querySelector(".motors-compatibility-table") ||
        doc.querySelector('[data-testid="d-motors-compatibility-table"]') ||
        doc.querySelector('[data-testid="d-item-compatibility"] table');
      if (!table) {
        return results;
      }
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 3) {
          return;
        }
        const year = clean(cells[0]?.textContent || "");
        const make = clean(cells[1]?.textContent || "");
        const model = clean(cells[2]?.textContent || "");
        if (!year || !make || !model) {
          return;
        }
        results.push({
          year,
          make,
          model,
          trim: clean(cells[3]?.textContent || ""),
          engine: clean(cells[4]?.textContent || ""),
          notes: clean(cells[5]?.textContent || ""),
        });
      });
      return results;
    }, chunk);
    rows.push(...parsed);
  }
  return rows;
}

function listingHasFitmentMarkup(html) {
  if (!html || typeof html !== "string") {
    return false;
  }
  return /motors-compatibility-table|d-motors-compatibility-table|d-item-compatibility|compatible vehicles/i.test(
    html,
  );
}

/**
 * eBay intermittently answers the scraper with a 403 "Error Page" instead of
 * the listing. It is not listing-specific and not sticky: the very next attempt
 * usually succeeds, so a block must be retried rather than reported as "this
 * listing has no compatibility table".
 */
async function isBlockedPage(page) {
  try {
    return await page.evaluate(
      'document.title.toLowerCase().indexOf("error page") >= 0 ||' +
        ' (document.body ? document.body.innerText : "").toLowerCase().indexOf("something went wrong on our end") >= 0 ||' +
        ' (document.body ? document.body.innerText : "").toLowerCase().indexOf("pardon our interruption") >= 0 ||' +
        ' (document.body ? document.body.innerText : "").toLowerCase().indexOf("checking your browser") >= 0',
    );
  } catch {
    return false;
  }
}

const LIVE_NAV_ATTEMPTS = 4;

/**
 * Returns "ok" when the compatibility table is on screen, "blocked" when eBay
 * kept serving an anti-bot page, and "no-table" when the listing loaded fine
 * but genuinely has no fitment. Callers must not treat "blocked" as "no-table".
 */
async function openLiveListing(page, listingUrl) {
  const tableSelectors = [
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
      const blocked = status >= 400 || (await isBlockedPage(page));
      if (blocked) {
        console.log(
          `[FetchFitment] attempt ${attempt}/${LIVE_NAV_ATTEMPTS}: eBay served a block page (http ${status}); retrying`,
        );
        await sleep(1500 * attempt + Math.floor(Math.random() * 700));
        continue;
      }

      blockedEveryTime = false;

      try {
        await Promise.race(
          tableSelectors.map((selector) => page.waitForSelector(selector, { timeout: 20000 })),
        );
        console.log(`[FetchFitment] attempt ${attempt}: compatibility table found`);
        return "ok";
      } catch {
        console.log(
          `[FetchFitment] attempt ${attempt}: listing loaded but has no compatibility table`,
        );
        return "no-table";
      }
    } catch (error) {
      console.log(
        `[FetchFitment] attempt ${attempt}/${LIVE_NAV_ATTEMPTS} navigation failed: ${error.message}`,
      );
      await sleep(1500 * attempt);
    }
  }

  return blockedEveryTime ? "blocked" : "no-table";
}

export async function fetchFitment(page, listingUrl, options = {}) {
  console.log(`[FetchFitment] Starting fitment extraction for: ${listingUrl}`);
  const onProgress = typeof options.onFitmentProgress === "function" ? options.onFitmentProgress : null;
  const html = typeof options.html === "string" ? options.html : "";

  try {
    if (!page) {
      return {
        success: false,
        compatibility: [],
        compatibilityCount: 0,
        error: "Browser page is not available",
      };
    }

    if (html && !listingHasFitmentMarkup(html)) {
      console.log("[FetchFitment] Listing HTML has no compatibility table; skipping live navigation");
      return {
        success: true,
        compatibility: [],
        compatibilityCount: 0,
      };
    }

    let tableFound = false;
    try {
      tableFound = await hasCompatibilityTable(page);
    } catch (error) {
      console.log(`[FetchFitment] current page check failed: ${error.message}`);
    }

    if (!tableFound && html) {
      try {
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
        tableFound = await hasCompatibilityTable(page);
      } catch (error) {
        console.log(`[FetchFitment] HTML load failed: ${error.message}`);
      }
    }

    if (!tableFound) {
      let liveStatus = "no-table";
      try {
        liveStatus = await openLiveListing(page, listingUrl);
      } catch (error) {
        console.log(`[FetchFitment] live navigation failed: ${error.message}`);
      }

      // A block is a failure, not an empty result. Reporting success here is
      // what made "no compatibility" indistinguishable from "eBay blocked us".
      if (liveStatus === "blocked") {
        console.log("[FetchFitment] eBay blocked every navigation attempt");
        return {
          success: false,
          compatibility: [],
          compatibilityCount: 0,
          blocked: true,
          error: `eBay blocked the scraper after ${LIVE_NAV_ATTEMPTS} attempts. Try again in a moment.`,
        };
      }

      tableFound = liveStatus === "ok";
    }

    if (!tableFound) {
      console.log("[FetchFitment] No compatibility table on this listing");
      return {
        success: true,
        compatibility: [],
        compatibilityCount: 0,
      };
    }

    const liveTable = await hasCompatibilityTable(page);
    let rows = [];
    if (page.snapshotOnly) {
      rows = (await extractCompatibilityData(page)).compatibility;
    } else if (liveTable) {
      const onLiveListing = /\/itm\//i.test(page.url());
      if (!onLiveListing) {
        console.log(
          "[FetchFitment] Compatibility table is from an HTML snapshot (page 1 only). Opening the live listing to scrape every page.",
        );
        const opened = (await openLiveListing(page, listingUrl)) === "ok";
        if (!opened) {
          rows = (await extractCompatibilityData(page)).compatibility;
        } else {
          rows = await handlePagination(page, onProgress);
        }
      } else {
        console.log("[FetchFitment] Processing paginated compatibility data...");
        rows = await handlePagination(page, onProgress);
      }
    }

    if (html) {
      rows = uniqueRows([...rows, ...(await extractRowsFromHtmlChunks(page, html))]);
    } else {
      rows = uniqueRows(rows);
    }

    console.log(`[FetchFitment] Extracted ${rows.length} fitment rows`);
    return {
      success: true,
      compatibility: rows,
      compatibilityCount: rows.length,
    };
  } catch (error) {
    console.log(`[FetchFitment] Error: ${error.message}`);
    return {
      success: false,
      compatibility: [],
      compatibilityCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
