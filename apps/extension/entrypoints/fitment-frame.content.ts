/**
 * Do not inject into eBay's sellfit iframe. Native Edit already shows the
 * vehicle list; wrapping datastore/getTreeNodes replaces that view with a spinner.
 */
export default defineContentScript({
  matches: ["https://www.ebay.com/sellfit/*", "https://*.ebay.com/sellfit/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    return;
  },
});
