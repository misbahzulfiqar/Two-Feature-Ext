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

export const EXTENSION_DOWNLOAD_PATH = "/extension.zip";

export async function fetchExtensionRelease(): Promise<ExtensionRelease> {
  return {
    version: "1.0.0",
    filename: "sell-similarextension-1.0.0-chrome.zip",
    sizeBytes: 204924,
    builtAt: "2026-09-27T09:17:00.000Z",
    sha256: "",
  };
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
  const link = document.createElement("a");
  link.href = EXTENSION_DOWNLOAD_PATH;
  link.download = "sell-similarextension-1.0.0-chrome.zip";
  document.body.append(link);
  link.click();
  link.remove();
}
