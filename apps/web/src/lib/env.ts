export function publicEnv() {
  return {
    appUrl: import.meta.env.VITE_APP_URL ?? "http://127.0.0.1:3004",
    apiUrl: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001",
    extensionId: import.meta.env.VITE_CHROME_EXTENSION_ID ?? "",
    webstoreUrl: import.meta.env.VITE_CHROME_WEBSTORE_URL ?? "",
    ebaySellUrl: import.meta.env.VITE_EBAY_SELL_URL ?? "https://www.ebay.com/sl/prelist",
  };
}

export function apiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return normalized;
  }
  return `${publicEnv().apiUrl}${normalized}`;
}
