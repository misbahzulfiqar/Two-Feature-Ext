import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { JobName } from "@sell-similar/contracts";
import { createLogger } from "@sell-similar/logging";
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

agenda.define(refreshFitmentJob, async () => {
  logger.info("refresh-fitment scheduled job started");
});

await agenda.start();
await agenda.every("0 * * * *", refreshFitmentJob);

logger.info("cron scheduler started");
