import { getMongoClient } from "@sell-similar/ebay-models";
import type { Collection, Db } from "mongodb";

export async function adminDb(mongoUrl: string): Promise<Db> {
  const client = await getMongoClient(mongoUrl);
  return client.db();
}

export async function adminCollection<T extends object>(
  mongoUrl: string,
  name: string,
): Promise<Collection<T>> {
  const db = await adminDb(mongoUrl);
  return db.collection<T>(name);
}
