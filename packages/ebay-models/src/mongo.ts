import { MongoClient } from "mongodb";

const DEFAULT_DATABASE = "sell-similar";

let client: MongoClient | undefined;
let connectedUrl: string | undefined;

export function databaseNameFromUrl(mongoUrl: string): string {
  const withoutQuery = mongoUrl.split("?")[0] ?? mongoUrl;
  const afterHost = withoutQuery.replace(/^mongodb(\+srv)?:\/\/[^/]*/i, "");
  const name = decodeURIComponent(afterHost.replace(/^\//, "").split("/")[0] ?? "").trim();
  return name || DEFAULT_DATABASE;
}

export async function getMongoClient(mongoUrl: string): Promise<MongoClient> {
  if (client && connectedUrl === mongoUrl) {
    return client;
  }
  if (client) {
    await client.close();
    client = undefined;
  }
  client = new MongoClient(mongoUrl);
  await client.connect();
  connectedUrl = mongoUrl;
  return client;
}
