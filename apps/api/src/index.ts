import { loadEnv, loadRootEnv } from "@sell-similar/config";
import type { HealthResponse, SellSimilarResponse } from "@sell-similar/contracts";
import { createLogger, withCorrelationId } from "@sell-similar/logging";
import { sellSimilarRequestSchema } from "@sell-similar/validation";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { createAuth } from "./auth.js";
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

app.post("/listings/sell-similar", (req, res) => {
  const parsed = sellSimilarRequestSchema.safeParse(req.body);
  const log = withCorrelationId(logger, req.correlationId);

  if (!parsed.success) {
    const body: SellSimilarResponse = {
      ok: false,
      error: { code: "INVALID_REQUEST", message: parsed.error.message },
      correlationId: req.correlationId as SellSimilarResponse["correlationId"],
    };
    log.warn({ issues: parsed.error.issues }, "invalid sell-similar request");
    res.status(400).json(body);
    return;
  }

  const body: SellSimilarResponse = {
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Sell Similar lookup is not implemented yet",
    },
    correlationId: req.correlationId as SellSimilarResponse["correlationId"],
  };
  log.info({ sourceListingUrl: parsed.data.sourceListingUrl }, "sell-similar stub");
  res.status(501).json(body);
});

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "api listening");
});
