import { z } from "zod";

export const cronEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  MONGO_URL: z.string().min(1),
});

export type CronEnv = z.infer<typeof cronEnvSchema>;
