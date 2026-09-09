// apps/scraper-worker/src/FetchFitment.js

export async function fetchFitment(page, listingUrl) {
  console.log(`[FetchFitment] 🚀 Starting fitment extraction for: ${listingUrl}`);
  
  try {
      if (!page) {
          return {
              success: false,
              compatibility: [],
              compatibilityCount: 0,
              error: "Browser page is not available"
          };
      }

      // Wait for fitment table to load using the selectors you found
      const tableFound = await page.waitForFunction(
          () => {
              const hasTable = document.querySelector(
                  '[data-testid="d-motors-compatibility-table"], ' +
                  '.motors-compatibility-table, ' +
                  '[data-testid="ux-table-section"]'
              );
              return hasTable !== null;
          },
          { timeout: 15000 }
      ).then(() => true).catch(() => false);

      if (!tableFound) {
          console.log('[FetchFitment] ⚠️ No fitment table found on this listing');
          return {
              success: true,
              compatibility: [],
              compatibilityCount: 0
          };
      }

      console.log('[FetchFitment] ✅ Fitment table found');

      // Extract fitment rows using the DOM structure from your inspection
      const rows = await page.evaluate(() => {
          const clean = (text) => String(text || '')
              .replace(/\u00a0/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          
          const results = [];
          
          // Find the table using the selectors from your DOM inspection
          const table = document.querySelector(
              '.motors-compatibility-table table, ' +
              '[data-testid="ux-table-section"]'
          );
          
          if (table) {
              // Get all data rows (skip header)
              const rowElements = table.querySelectorAll('[data-testid="ux-table-section-body-row"]');
              console.log(`[FetchFitment] Found ${rowElements.length} rows in table`);
              
              rowElements.forEach(row => {
                  // Get all cells in the row
                  const cells = row.querySelectorAll('[data-testid="ux-table-section-body-cell"] .ux-textspans');
                  
                  if (cells.length >= 3) {
                      results.push({
                          year: clean(cells[0]?.textContent || ''),
                          make: clean(cells[1]?.textContent || ''),
                          model: clean(cells[2]?.textContent || ''),
                          trim: clean(cells[3]?.textContent || ''),
                          engine: clean(cells[4]?.textContent || ''),
                          notes: clean(cells[5]?.textContent || '')
                      });
                  }
              });
          }
          
          // If no rows found via table, try getting fitment count
          if (results.length === 0) {
              const countText = document.querySelector('.motors-compatibility-table__details-text')?.textContent || '';
              const match = countText.match(/(\d+)/);
              if (match) {
                  console.log(`[FetchFitment] Found ${match[1]} vehicles but no rows extracted`);
              }
          }
          
          return results;
      });

      console.log(`[FetchFitment] 📊 Extracted ${rows.length} fitment rows`);
      
      // Log sample for debugging
      if (rows.length > 0) {
          console.log(`[FetchFitment] 📋 Sample rows:`);
          rows.slice(0, 3).forEach((row, i) => {
              console.log(`[FetchFitment]   ${i+1}. ${row.year} ${row.make} ${row.model}`);
          });
      }

      return {
          success: true,
          compatibility: rows,
          compatibilityCount: rows.length
      };
      
  } catch (error) {
      console.log(`[FetchFitment] ❌ Error: ${error.message}`);
      return {
          success: false,
          compatibility: [],
          compatibilityCount: 0,
          error: error instanceof Error ? error.message : String(error)
      };
  }
}