import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    disabled: true,
  },
  manifest: {
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    permissions: ["storage", "activeTab"],
    host_permissions: [
      "https://*.ebay.com/*",
      "https://*.ebayimg.com/*",
      "https://i.ebayimg.com/*",
      "http://localhost:3001/*",
      "http://127.0.0.1:3001/*",
    ],
  },
});
