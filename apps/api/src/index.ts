import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { createAuth } from "./auth.js";
import { createListing, sellSimilar } from "./controllers/ListingsController.js";
import { correlationMiddleware } from "./correlation.js";
import { apiEnvSchema } from "./env.js";

loadRootEnv();

const env = loadEnv(apiEnvSchema);
const logger = createLogger({ name: "api", level: env.LOG_LEVEL });
const auth = createAuth(env);

const app = express();
app.use(correlationMiddleware);
app.all("/api/auth/{*path}", toNodeHandler(auth));
app.use(express.json());

app.get("/health", (req, res) => {
  const body: HealthResponse = { ok: true, service: "api" };
  withCorrelationId(logger, req.correlationId).info("health check");
  res.json(body);
});

app.post("/listings", createListing);
app.post("/listings/sell-similar", sellSimilar);

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "api listening");
});
