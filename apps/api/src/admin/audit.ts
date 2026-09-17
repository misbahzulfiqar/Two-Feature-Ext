import { AUDIT_EVENTS_COLLECTION, type AuditEventDoc } from "./types.js";
import { adminCollection } from "./db.js";

export async function writeAuditEvent(
  mongoUrl: string,
  event: Omit<AuditEventDoc, "createdAt">,
): Promise<void> {
  const collection = await adminCollection<AuditEventDoc>(mongoUrl, AUDIT_EVENTS_COLLECTION);
  await collection.insertOne({
    ...event,
    createdAt: new Date(),
  });
}

export async function ensureAuditIndexes(mongoUrl: string): Promise<void> {
  const collection = await adminCollection<AuditEventDoc>(mongoUrl, AUDIT_EVENTS_COLLECTION);
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ event: 1, createdAt: -1 });
  await collection.createIndex({ userId: 1, createdAt: -1 });
  await collection.createIndex({ jobId: 1, createdAt: -1 });
  await collection.createIndex({ listingId: 1, createdAt: -1 });
}
