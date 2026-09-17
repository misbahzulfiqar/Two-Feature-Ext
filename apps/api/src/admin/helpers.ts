import type { Request } from "express";

export function sanitizeAdminText(value: string): string {
  return value
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "[redacted]")
    .replace(/redis:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/cookie[s]?:[^\n]+/gi, "[redacted]")
    .slice(0, 800);
}

export function parsePositiveInt(value: unknown, fallback: number, max = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function rangeDays(value: unknown): number {
  const raw = typeof value === "string" ? value : "7d";
  if (raw === "30d") {
    return 30;
  }
  if (raw === "90d") {
    return 90;
  }
  if (raw === "1d") {
    return 1;
  }
  return 7;
}

export function startOfRange(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

export function durationMs(startedAt: Date | null | undefined, completedAt: Date | null | undefined): number | null {
  if (!startedAt || !completedAt) {
    return null;
  }
  const ms = completedAt.getTime() - startedAt.getTime();
  return ms >= 0 ? ms : null;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) {
    return "—";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function canonicalEbayUrl(itemId: string): string | null {
  if (!/^\d{6,20}$/.test(itemId)) {
    return null;
  }
  return `https://www.ebay.com/itm/${itemId}`;
}

export function queryString(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

export function classifyJobError(message: string): {
  code: string;
  description: string;
  severity: "critical" | "warning" | "info";
} {
  const text = message.toLowerCase();
  if (text.includes("timeout") || text.includes("timed out")) {
    return { code: "SCRAPE_TIMEOUT", description: "The scrape exceeded the allowed time.", severity: "warning" };
  }
  if (text.includes("not found") || text.includes("404")) {
    return { code: "SOURCE_NOT_FOUND", description: "The source listing could not be found.", severity: "warning" };
  }
  if (text.includes("layout") || text.includes("selector")) {
    return { code: "EBAY_LAYOUT_CHANGED", description: "eBay page layout did not match expected selectors.", severity: "critical" };
  }
  if (text.includes("fitment") && (text.includes("empty") || text.includes("no "))) {
    return { code: "FITMENT_EMPTY", description: "No vehicle fitment records were found.", severity: "info" };
  }
  if (text.includes("auth") || text.includes("unauthorized") || text.includes("forbidden")) {
    return { code: "AUTH_REQUIRED", description: "Authentication was required to continue.", severity: "critical" };
  }
  if (text.includes("invalid") && text.includes("source")) {
    return { code: "INVALID_SOURCE", description: "The source listing URL or item ID is invalid.", severity: "warning" };
  }
  if (text.includes("marketplace")) {
    return { code: "UNSUPPORTED_MARKETPLACE", description: "This marketplace is not supported.", severity: "warning" };
  }
  if (text.includes("queue") || text.includes("busy")) {
    return { code: "QUEUE_BUSY", description: "The scrape queue was busy.", severity: "warning" };
  }
  return { code: "SCRAPE_FAILED", description: sanitizeAdminText(message), severity: "warning" };
}

export function isRetryableFailure(status: string, error: string | null): boolean {
  if (status !== "failed") {
    return false;
  }
  const text = (error ?? "").toLowerCase();
  if (text.includes("auth") || text.includes("unauthorized") || text.includes("forbidden")) {
    return false;
  }
  if (text.includes("invalid source") || text.includes("invalid listing")) {
    return false;
  }
  return true;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
