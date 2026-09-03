import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    disabled: true,
  },
  manifest: {
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      96: "/icon-96.png",
      128: "/icon-128.png",
    },
    action: {
      default_icon: {
        16: "/icon-16.png",
        32: "/icon-32.png",
        48: "/icon-48.png",
        128: "/icon-128.png",
      },
    },
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
