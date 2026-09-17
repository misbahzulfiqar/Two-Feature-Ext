import {
  DEFAULT_ADMIN_SETTINGS,
  SETTINGS_COLLECTION,
  SETTINGS_ID,
  type AdminSettingsDoc,
} from "./types.js";
import { adminCollection } from "./db.js";

let cached: { value: AdminSettingsDoc; expiresAt: number } | null = null;

function mergeSettings(raw: Partial<AdminSettingsDoc> | null): AdminSettingsDoc {
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...raw,
    features: {
      ...DEFAULT_ADMIN_SETTINGS.features,
      ...raw?.features,
    },
    maintenance: {
      ...DEFAULT_ADMIN_SETTINGS.maintenance,
      ...raw?.maintenance,
    },
    updatedAt: raw?.updatedAt instanceof Date ? raw.updatedAt : new Date(),
  };
}

export async function getAdminSettings(mongoUrl: string): Promise<AdminSettingsDoc> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  try {
    const collection = await adminCollection<AdminSettingsDoc & { _id: string }>(
      mongoUrl,
      SETTINGS_COLLECTION,
    );
    const doc = await collection.findOne({ _id: SETTINGS_ID } as never);
    const value = mergeSettings(doc);
    cached = { value, expiresAt: now + 5_000 };
    return value;
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export async function saveAdminSettings(
  mongoUrl: string,
  next: AdminSettingsDoc,
): Promise<AdminSettingsDoc> {
  const collection = await adminCollection<AdminSettingsDoc & { _id: string }>(
    mongoUrl,
    SETTINGS_COLLECTION,
  );
  const stored = { ...next, updatedAt: new Date() };
  await collection.updateOne(
    { _id: SETTINGS_ID } as never,
    { $set: { ...stored, _id: SETTINGS_ID } },
    { upsert: true },
  );
  cached = { value: stored, expiresAt: Date.now() + 5_000 };
  return stored;
}

export function clearSettingsCache(): void {
  cached = null;
}
