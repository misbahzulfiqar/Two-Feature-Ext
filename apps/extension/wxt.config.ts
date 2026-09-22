import { defineConfig } from "wxt";

const PRODUCTION_WEB_MATCHES = [
  "https://extension.carvmac.com/*",
  "https://extension-admin.carvmac.com/*",
];

const PRODUCTION_HOST_PERMISSIONS = [
  "https://*.ebay.com/*",
  "https://ebay.com/*",
  "https://*.ebayimg.com/*",
  "https://i.ebayimg.com/*",
  // The background script calls the API directly, so it needs host access to
  // the API origin as well as the web app.
  "https://extension.carvmac.com/*",
  "https://extension-admin.carvmac.com/*",
  "https://extension-api.carvmac.com/*",
];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    disabled: true,
  },
  dev: {
    server: {
      host: "127.0.0.1",
      port: 3010,
      origin: "http://127.0.0.1:3010",
    },
  },
  manifest: {
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    homepage_url: "https://extension.carvmac.com",
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
    permissions: ["storage", "activeTab", "webNavigation", "scripting", "tabs"],
    externally_connectable: {
      matches:
        process.env.NODE_ENV === "production"
          ? PRODUCTION_WEB_MATCHES
          : [
              ...PRODUCTION_WEB_MATCHES,
              "http://localhost:3004/*",
              "http://127.0.0.1:3004/*",
            ],
    },
    host_permissions:
      process.env.NODE_ENV === "production"
        ? PRODUCTION_HOST_PERMISSIONS
        : [
            ...PRODUCTION_HOST_PERMISSIONS,
            "http://localhost:3004/*",
            "http://127.0.0.1:3004/*",
            "ws://localhost:3010/*",
            "ws://127.0.0.1:3010/*",
            "http://localhost:3001/*",
            "http://127.0.0.1:3001/*",
          ],
  },
});
