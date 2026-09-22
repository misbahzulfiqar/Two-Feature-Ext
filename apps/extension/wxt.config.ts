import { defineConfig } from "wxt";

const PRODUCTION_WEB_MATCHES = [
  "https://extension.carvmax.com/*",
  "https://extension-admin.carvmax.com/*",
];

const PRODUCTION_HOST_PERMISSIONS = [
  "https://*.ebay.com/*",
  "https://ebay.com/*",
  "https://*.ebayimg.com/*",
  "https://i.ebayimg.com/*",
  // The background script calls the API directly, so it needs host access to
  // the API origin as well as the web app.
  "https://extension.carvmax.com/*",
  "https://extension-admin.carvmax.com/*",
  "https://extension-api.carvmax.com/*",
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
    // Pins the extension ID to plohbfpfbfppmlnamocnoelnefchplnm.
    //
    // Chrome derives the ID from this public key. Without it, every
    // "Load unpacked" install gets a different ID (derived from the folder
    // path), which would break externally_connectable messaging and the
    // website's install detection. Public by design - it ships in manifest.json.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA24wXNLk0wbWF0hPIHaJS9AQY9DB9MVvbGL0rxirvzeV9xskPElID5Vhh3ji6l3n+ofVN66uMiRNIEskuOKyelHJyRSnZg4NoJRrD/aY8arZprXt2+cZlV+S4PmZK2xMOXPUDViceeVJErHcsk5jbXNltv8aEtuQvxhEwIBoGbyW2orVlEMaxL1B/SB0pTRKLqe5ZBU4md3u8EUSvdo5ljctjAcrfFauu47/MEgqHJazXC74UGxJNgu+zE5THvUw4qtycuOfLig9q0VUV8vZg6ucMmwbB/46INJ5Mn1qTE+ocUR45JQjMQQzFpnpK7N4QbUaPUgxN5RP/ozQcda/oxwIDAQAB",
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    homepage_url: "https://extension.carvmax.com",
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
