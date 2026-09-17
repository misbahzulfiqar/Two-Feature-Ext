import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { JobName } from "@sell-similar/contracts";
import { createLogger } from "@sell-similar/logging";
import { cleanupOldScrapeJobs, failStuckScrapeJobs, getMongoClient } from "@sell-similar/ebay-models";
import { MongoBackend } from "@agendajs/mongo-backend";
import { Agenda } from "agenda";
import { cronEnvSchema } from "./env.js";

loadRootEnv();

const env = loadEnv(cronEnvSchema);
const logger = createLogger({ name: "cron", level: env.LOG_LEVEL });
const refreshFitmentJob: JobName = "refresh-fitment";

const agenda = new Agenda({
  backend: new MongoBackend({
    address: env.MONGO_URL,
    collection: "cronJobs",
  }),
});

async function readRetentionAndTimeout(): Promise<{ retentionDays: number; timeoutSeconds: number }> {
  const db = (await getMongoClient(env.MONGO_URL)).db();
  const settings = await db.collection("adminSettings").findOne({ _id: "global" } as never);
  return {
    retentionDays: typeof settings?.progressRetentionDays === "number" ? settings.progressRetentionDays : 30,
    timeoutSeconds: typeof settings?.jobTimeoutSeconds === "number" ? settings.jobTimeoutSeconds : 120,
  };
}

agenda.define(refreshFitmentJob, async () => {
  logger.info("refresh-fitment scheduled job started");
});

agenda.define("cleanupOldJobs", async () => {
  const { retentionDays } = await readRetentionAndTimeout();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await cleanupOldScrapeJobs(env.MONGO_URL, cutoff);
  logger.info({ deleted, retentionDays }, "cleanupOldJobs finished");
});

agenda.define("reconcileStuckJobs", async () => {
  const { timeoutSeconds } = await readRetentionAndTimeout();
  const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
  const updated = await failStuckScrapeJobs(env.MONGO_URL, cutoff);
  logger.info({ updated, timeoutSeconds }, "reconcileStuckJobs finished");
});

agenda.define("healthCheck", async () => {
  const db = (await getMongoClient(env.MONGO_URL)).db();
  await db.command({ ping: 1 });
  logger.info("healthCheck ping succeeded");
});

await agenda.start();
await agenda.every("0 * * * *", refreshFitmentJob);
await agenda.every("15 * * * *", "cleanupOldJobs");
await agenda.every("*/5 * * * *", "reconcileStuckJobs");
await agenda.every("*/5 * * * *", "healthCheck");

logger.info("cron scheduler started");
