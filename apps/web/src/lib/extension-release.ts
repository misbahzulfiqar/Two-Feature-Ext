import { apiPath } from "./env";

/**
 * The extension is distributed by direct download rather than the Chrome Web
 * Store, so the dashboard needs the current build's details and a way to fetch
 * the file. Both endpoints require a signed-in session.
 */
export type ExtensionRelease = {
  version: string;
  filename: string;
  sizeBytes: number;
  builtAt: string;
  sha256: string;
};

export const EXTENSION_DOWNLOAD_PATH = "/extension/download";

export async function fetchExtensionRelease(): Promise<ExtensionRelease> {
  const response = await fetch(apiPath("/extension/release"), {
    credentials: "include",
  });
  const body: unknown = await response.json().catch(() => null);

  const failed =
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("ok" in body) ||
    body.ok !== true;

  if (failed) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error
        ? String(body.error.message)
        : "Could not load the extension build";
    throw new Error(message);
  }

  return (body as unknown as { data: ExtensionRelease }).data;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "unknown size";
  }
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function formatBuildDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown date";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Triggers the download through a normal navigation so the browser sends the
 * session cookie and honours Content-Disposition. Fetching into a blob would
 * work too, but would buffer the whole zip in memory for no benefit.
 */
export function startExtensionDownload(): void {
  window.location.href = apiPath(EXTENSION_DOWNLOAD_PATH);
}
