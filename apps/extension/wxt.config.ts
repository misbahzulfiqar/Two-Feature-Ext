import { defineConfig } from "wxt";

const WEB_ORIGIN = "https://two-feature-ext.vercel.app";
const ADMIN_ORIGIN = "https://two-feature-admin.vercel.app";
const API_ORIGIN = "https://two-feature-api.vercel.app";

const PRODUCTION_WEB_MATCHES = [`${WEB_ORIGIN}/*`, `${ADMIN_ORIGIN}/*`];

const PRODUCTION_HOST_PERMISSIONS = [
  "https://*.ebay.com/*",
  "https://ebay.com/*",
  "https://*.ebayimg.com/*",
  "https://i.ebayimg.com/*",
  `${WEB_ORIGIN}/*`,
  `${ADMIN_ORIGIN}/*`,
  `${API_ORIGIN}/*`,
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
    // New public key for this copy only. Chrome derives a different extension
    // ID from it, so this build cannot replace the original published extension.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmx3y7JOFe/P1Eng7RYSB1TUkpcdvsJbao01iBe53kM+WAQDGuCv3YZB23o4wET9lsZrkaYOXwh9fNHxql5i3Lh5MgTtuuSxfmK/APaUJxMKFrOtVgbbzP+uJn6fW3ludKtUt73uhdtxqAXzYqkmAg4n4IXVxy1UrllZ3tOg9fBd+TDGqJRavrCvOG12ecm8zahyYgDM4fL2fklUFHhiMgPMruP5ALK4Yw7GatE7EuGcR3Uau1lwpWqxMJz7mXHFP8olfL2qm+uXt+QGa9MUx6cshapDfPY5QUaF4cIZPlnbwgp/4Vm9425JwqRTde7RqgVVnkdBHXUCYBZeaDhVoDwIDAQAB",
    name: "Sell Similar",
    description: "Find and list similar items on eBay",
    homepage_url: WEB_ORIGIN,
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
