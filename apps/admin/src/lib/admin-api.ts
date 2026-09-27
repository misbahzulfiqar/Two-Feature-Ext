import { adminIdentityHeaders } from "./auth-client";
import { apiPath } from "./env";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...adminIdentityHeaders(),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload.error as { code?: string; message?: string })
        : undefined;
    throw new AdminApiError(
      error?.message || "Request failed",
      response.status,
      error?.code || "REQUEST_FAILED",
    );
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function adminGet<T>(path: string): Promise<T> {
  return adminRequest<T>(path);
}

export function adminSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return adminRequest<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export type AdminJob = {
  jobId: string;
  user: { id: string; name: string; email: string } | null;
  sourceItemId: string;
  sourceUrl: string | null;
  mode: string;
  status: string;
  duration: string;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  progress: { stage?: string; percent?: number } | null;
  retryable?: boolean;
  listingUrl?: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: string;
  jobs: number;
  lastActive: string | null;
};

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
