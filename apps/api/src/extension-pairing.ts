import { createHash, randomBytes } from "node:crypto";

const PAIRING_TTL_MS = 3 * 60_000;

type PairingRecord = {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
  used: boolean;
};

const pairingByHash = new Map<string, PairingRecord>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function pruneExpired(now = Date.now()): void {
  for (const [key, record] of pairingByHash) {
    if (record.used || record.expiresAt <= now) {
      pairingByHash.delete(key);
    }
  }
}

export function issuePairingToken(user: {
  id: string;
  email: string;
  name: string;
}): { token: string; expiresAt: string } {
  pruneExpired();
  const token = randomBytes(32).toString("base64url");
  pairingByHash.set(hashToken(token), {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + PAIRING_TTL_MS,
    used: false,
  });
  return {
    token,
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
}

export function exchangePairingToken(token: string): PairingRecord | null {
  pruneExpired();
  const hashed = hashToken(token);
  const record = pairingByHash.get(hashed);
  if (!record || record.used || record.expiresAt <= Date.now()) {
    return null;
  }
  record.used = true;
  pairingByHash.delete(hashed);
  return record;
}
