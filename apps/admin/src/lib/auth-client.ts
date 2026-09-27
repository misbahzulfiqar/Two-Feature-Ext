import { useSyncExternalStore } from "react";

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

const STORAGE_KEY = "admin-session";

type AuthResult = { error: { message: string } | null };

type StoredUser = {
  name: string;
  email: string;
  emailVerified: true;
  role: "admin";
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

function readInput(input: unknown): { email: string; password: string } {
  if (!input || typeof input !== "object") {
    return { email: "", password: "" };
  }
  const row = input as Record<string, unknown>;
  return {
    email: typeof row.email === "string" ? row.email.trim() : "",
    password: typeof row.password === "string" ? row.password : "",
  };
}

/** Any email and password opens the admin panel. Email is not verified. */
async function signInEmail(input?: unknown): Promise<AuthResult> {
  const fields = readInput(input);
  if (!fields.email || !fields.password) {
    return { error: { message: "Enter your email and password." } };
  }
  saveUser({
    name: fields.email.split("@")[0] || "Admin",
    email: fields.email,
    emailVerified: true,
    role: "admin",
    createdAt: new Date().toISOString(),
  });
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
  changePassword: async (_input?: unknown): Promise<AuthResult> => ({ error: null }),
  sendVerificationEmail: async (_input?: unknown): Promise<AuthResult> => ({ error: null }),
};

export async function confirmSignedIn(): Promise<string | null> {
  return current?.user?.email ? null : "Enter your email and password.";
}

export function adminIdentityHeaders(): Record<string, string> {
  const user = current?.user;
  const headers: Record<string, string> = {};
  if (user?.email) {
    headers["x-admin-email"] = user.email;
  }
  if (user?.name) {
    headers["x-admin-name"] = user.name;
  }
  return headers;
}
