export function publicEnv() {
  return {
    appUrl: import.meta.env.VITE_APP_URL ?? "http://127.0.0.1:3005",
    apiUrl: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001",
  };
}

export function apiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return normalized;
  }
  return `${publicEnv().apiUrl}${normalized}`;
}
