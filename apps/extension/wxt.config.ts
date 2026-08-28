import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    permissions: ["storage", "activeTab"],
    host_permissions: ["https://*.ebay.com/*", "http://localhost/*"],
  },
});
