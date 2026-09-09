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

async function handlePagination(page, onProgress) {
  let allCompatibility = [];
  let currentPage = 1;
  let hasNextPage = true;
  let retryCount = 0;
  const maxRetries = 5;
  const tableSelectors = [
    ".motors-compatibility-table",
    '[data-testid="d-motors-compatibility-table"]',
    ".motors-compatibility-table-wrapper",
  ];

  while (hasNextPage && retryCount < maxRetries) {
    try {
      await Promise.race(
        tableSelectors.map((selector) => page.waitForSelector(selector, { timeout: 30000 })),
      );

      const pageData = await extractCompatibilityData(page);
      allCompatibility = allCompatibility.concat(pageData.compatibility);
      console.log(
        `[FetchFitment] Page ${currentPage}: extracted ${pageData.compatibility.length} rows (total: ${allCompatibility.length})`,
      );
      if (onProgress) {
        await onProgress(
          currentPage,
          allCompatibility.length,
          `Scraped page ${currentPage} — ${allCompatibility.length} vehicles found so far`,
        );
      }

      const nextPageAvailable = await page.evaluate(() => {
        const nextButton = document.querySelector(
          '.pagination__next:not([aria-disabled="true"])',
        );
        return nextButton !== null;
      });

      if (!nextPageAvailable) {
        hasNextPage = false;
        break;
      }

      const firstRowTextBefore = await page.evaluate(() => {
        const firstRow =
          document.querySelector(".motors-compatibility-table tbody.ux-table-section__body tr") ||
          document.querySelector('[data-testid="d-motors-compatibility-table"] tbody tr') ||
          document.querySelector(".motors-compatibility-table-wrapper tbody tr");
        return firstRow ? firstRow.textContent.trim() : "";
      });

      currentPage += 1;
      console.log(`[FetchFitment] Navigating to page ${currentPage}...`);
      await page.evaluate(() => {
        document.querySelector('.pagination__next:not([aria-disabled="true"])')?.click();
      });

      await page.waitForFunction(
        (prevFirstRowText) => {
          const firstRow =
            document.querySelector(".motors-compatibility-table tbody.ux-table-section__body tr") ||
            document.querySelector('[data-testid="d-motors-compatibility-table"] tbody tr') ||
            document.querySelector(".motors-compatibility-table-wrapper tbody tr");
          if (!firstRow) {
            return false;
          }
          return firstRow.textContent.trim() !== prevFirstRowText;
        },
        { timeout: 30000 },
        firstRowTextBefore,
      );

      await sleep(1000);
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
        hasNextPage = false;
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

async function openLiveListing(page, listingUrl) {
  try {
    await page.goto("https://www.ebay.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
      referer: "https://www.google.com/",
    });
    await sleep(800 + Math.floor(Math.random() * 400));
  } catch (error) {
    console.log(`[FetchFitment] homepage warmup failed: ${error.message}`);
  }

  await page.goto(listingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
    referer: "https://www.ebay.com/",
  });

  const tableSelectors = [
    ".motors-compatibility-table",
    '[data-testid="d-motors-compatibility-table"]',
    '[data-testid="d-item-compatibility"]',
    ".motors-compatibility-table-wrapper",
  ];
  try {
    await Promise.race(
      tableSelectors.map((selector) => page.waitForSelector(selector, { timeout: 8000 })),
    );
    return true;
  } catch {
    console.log("[FetchFitment] no compatibility table after live navigation");
    return false;
  }
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

    let tableFound = false;
    try {
      tableFound = await openLiveListing(page, listingUrl);
    } catch (error) {
      console.log(`[FetchFitment] live navigation failed: ${error.message}`);
    }

    if (!tableFound && html) {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
      tableFound = await hasCompatibilityTable(page);
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
    if (liveTable && page.url().includes("/itm/")) {
      console.log("[FetchFitment] Processing paginated compatibility data...");
      rows = await handlePagination(page, onProgress);
    } else {
      const pageData = await extractCompatibilityData(page);
      rows = pageData.compatibility;
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
