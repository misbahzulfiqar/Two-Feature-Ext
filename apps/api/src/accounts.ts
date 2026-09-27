import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { adminCollection } from "./admin/db.js";

export type AccountRole = "user" | "admin";
export type AccountStatus = "active" | "disabled";

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  jobs: number;
  lastActive: string | null;
};

type StoredAccount = PublicAccount & {
  passwordHash: string;
  salt: string;
};

const memory = new Map<string, StoredAccount>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function passwordsMatch(password: string, salt: string, hash: string): boolean {
  const next = Buffer.from(hashPassword(password, salt), "hex");
  const saved = Buffer.from(hash, "hex");
  if (next.length !== saved.length) {
    return false;
  }
  return timingSafeEqual(next, saved);
}

function toPublic(account: StoredAccount): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    jobs: account.jobs,
    lastActive: account.lastActive,
  };
}

async function collection(mongoUrl: string | undefined) {
  if (!mongoUrl) {
    return null;
  }
  try {
    return await adminCollection<StoredAccount>(mongoUrl, "site_users");
  } catch {
    return null;
  }
}

async function remember(mongoUrl: string | undefined, account: StoredAccount): Promise<void> {
  memory.set(account.email, account);
  const col = await collection(mongoUrl);
  if (!col) {
    return;
  }
  await col.updateOne({ email: account.email }, { $set: account }, { upsert: true }).catch(() => undefined);
}

export async function loadAccounts(mongoUrl: string | undefined): Promise<StoredAccount[]> {
  const col = await collection(mongoUrl);
  if (col) {
    const docs = await col.find({}).toArray().catch(() => []);
    for (const doc of docs) {
      if (doc.email && doc.passwordHash && doc.salt) {
        memory.set(doc.email, doc);
      }
    }
  }
  return [...memory.values()];
}

export async function registerAccount(
  mongoUrl: string | undefined,
  input: { name: string; email: string; password: string; role?: AccountRole },
): Promise<{ account?: PublicAccount; error?: string }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password;
  if (!name) {
    return { error: "Enter your name." };
  }
  if (!email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  await loadAccounts(mongoUrl);
  if (memory.has(email)) {
    return { error: "An account with this email already exists. Log in instead." };
  }
  const salt = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const account: StoredAccount = {
    id: randomBytes(12).toString("hex"),
    name,
    email,
    role: input.role === "admin" ? "admin" : "user",
    status: "active",
    createdAt: now,
    jobs: 0,
    lastActive: now,
    salt,
    passwordHash: hashPassword(password, salt),
  };
  await remember(mongoUrl, account);
  return { account: toPublic(account) };
}

export async function loginAccount(
  mongoUrl: string | undefined,
  input: { email: string; password: string },
): Promise<{ account?: PublicAccount; error?: string }> {
  const email = normalizeEmail(input.email);
  const password = input.password;
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  await loadAccounts(mongoUrl);
  const account = memory.get(email);
  if (!account || !passwordsMatch(password, account.salt, account.passwordHash)) {
    return { error: "Invalid email or password." };
  }
  if (account.status === "disabled") {
    return { error: "This account is disabled." };
  }
  account.lastActive = new Date().toISOString();
  await remember(mongoUrl, account);
  return { account: toPublic(account) };
}

export async function updateAccount(
  mongoUrl: string | undefined,
  id: string,
  patch: { name?: string; status?: AccountStatus },
): Promise<PublicAccount | undefined> {
  await loadAccounts(mongoUrl);
  const account = [...memory.values()].find((row) => row.id === id);
  if (!account) {
    return undefined;
  }
  if (patch.name?.trim()) {
    account.name = patch.name.trim();
  }
  if (patch.status === "active" || patch.status === "disabled") {
    account.status = patch.status;
  }
  await remember(mongoUrl, account);
  return toPublic(account);
}
