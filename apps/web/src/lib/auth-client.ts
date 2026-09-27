import { useSyncExternalStore } from "react";
import { apiPath } from "./env";

type SessionUser = {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  createdAt?: string | Date;
};

type SessionData = {
  user?: SessionUser;
} | null;

const STORAGE_KEY = "sell-similar-user";

type AuthResult = { error: { message: string } | null };

type StoredUser = {
  name: string;
  email: string;
  emailVerified: true;
  role: "user";
  createdAt: string;
};

let current: SessionData = readStored();
const listeners = new Set<() => void>();

function readStored(): SessionData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw) as StoredUser;
    if (!user.email) {
      return null;
    }
    return { user };
  } catch {
    return null;
  }
}

function saveUser(user: StoredUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  current = { user };
  for (const listener of listeners) {
    listener();
  }
}

function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
  current = null;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readInput(input: unknown): { name: string; email: string; password: string } {
  if (!input || typeof input !== "object") {
    return { name: "", email: "", password: "" };
  }
  const row = input as Record<string, unknown>;
  return {
    name: typeof row.name === "string" ? row.name : "",
    email: typeof row.email === "string" ? row.email : "",
    password: typeof row.password === "string" ? row.password : "",
  };
}

async function postAccount(
  path: string,
  body: { name?: string; email: string; password: string },
): Promise<{ user?: StoredUser; error?: string }> {
  const response = await fetch(apiPath(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error
        ? String(payload.error.message)
        : "Could not reach the account server.";
    return { error: message };
  }
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: { name?: string; email?: string; createdAt?: string } }).data
      : undefined;
  if (!data?.email) {
    return { error: "Could not read the account." };
  }
  return {
    user: {
      name: data.name?.trim() || data.email.split("@")[0] || "there",
      email: data.email,
      emailVerified: true,
      role: "user",
      createdAt: data.createdAt || new Date().toISOString(),
    },
  };
}

async function signUpEmail(input?: unknown): Promise<AuthResult> {
  const fields = readInput(input);
  const result = await postAccount("/api/accounts/register", fields);
  if (result.error || !result.user) {
    return { error: { message: result.error || "Could not create the account" } };
  }
  saveUser(result.user);
  return { error: null };
}

async function signInEmail(input?: unknown): Promise<AuthResult> {
  const fields = readInput(input);
  const result = await postAccount("/api/accounts/login", {
    email: fields.email,
    password: fields.password,
  });
  if (result.error || !result.user) {
    return { error: { message: result.error || "Invalid email or password." } };
  }
  saveUser(result.user);
  return { error: null };
}

async function accepted(_input?: unknown): Promise<AuthResult> {
  return { error: null };
}

export const authClient = {
  useSession: () => {
    const data = useSyncExternalStore(subscribe, () => current, () => null);
    return { data, error: null, isPending: false };
  },
  getSession: async (_input?: unknown) => ({ data: current, error: null, isPending: false }),
  signOut: async () => {
    clearUser();
  },
  signIn: { email: signInEmail },
  signUp: { email: signUpEmail },
  requestPasswordReset: accepted,
  resetPassword: accepted,
  changePassword: async (_input?: unknown): Promise<AuthResult> => ({
    error: { message: "Password changes are turned off." },
  }),
  sendVerificationEmail: accepted,
};

export async function confirmSignedIn(): Promise<string | null> {
  return current?.user?.email ? null : "Sign in again.";
}
