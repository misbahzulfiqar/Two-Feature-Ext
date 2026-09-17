import { getAdminSettings, saveAdminSettings } from "./settings.js";
import { ensureAuditIndexes } from "./audit.js";
import { adminCollection } from "./db.js";
import {
  DEFAULT_ADMIN_SETTINGS,
  SETTINGS_COLLECTION,
  SETTINGS_ID,
  USER_SETTINGS_COLLECTION,
  type AdminSettingsDoc,
  type UserSettingsDoc,
} from "./types.js";
import {
  backfillScrapedListings,
  getListingImagesCollection,
  getScrapeJobsCollection,
  getScrapedListingsCollection,
} from "@sell-similar/ebay-models";

export async function ensureAdminDataStores(mongoUrl: string): Promise<void> {
  await getScrapeJobsCollection(mongoUrl);
  await getListingImagesCollection(mongoUrl);
  await getScrapedListingsCollection(mongoUrl);
  await backfillScrapedListings(mongoUrl);
  await ensureAuditIndexes(mongoUrl);
  const settings = await adminCollection<AdminSettingsDoc & { _id: string }>(
    mongoUrl,
    SETTINGS_COLLECTION,
  );
  const existing = await settings.findOne({ _id: SETTINGS_ID } as never);
  if (!existing) {
    await saveAdminSettings(mongoUrl, {
      ...DEFAULT_ADMIN_SETTINGS,
      updatedAt: new Date(),
    });
  } else {
    await getAdminSettings(mongoUrl);
  }
  const userSettings = await adminCollection<UserSettingsDoc>(mongoUrl, USER_SETTINGS_COLLECTION);
  await userSettings.createIndex({ userId: 1 }, { unique: true });
}
