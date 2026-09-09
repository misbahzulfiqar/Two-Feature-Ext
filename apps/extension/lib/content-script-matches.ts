export const EBAY_LISTING_EDITOR_MATCHES = [
  "*://*.ebay.com/*",
  "*://ebay.com/*",
] as const;

export const EBAY_CONTENT_SCRIPT_EXCLUDE_MATCHES = [
  "*://*.ebay.com/itm/*",
  "*://ebay.com/itm/*",
  "*://*.ebay.com/sellfit",
  "*://*.ebay.com/sellfit/*",
  "*://ebay.com/sellfit",
  "*://ebay.com/sellfit/*",
  "*://*.ebay.com/sl/prelist*",
  "*://ebay.com/sl/prelist*",
  "*://ir.ebaystatic.com/*",
  "*://*.ebaystatic.com/*",
  "*://rover.ebay.com/*",
] as const;
