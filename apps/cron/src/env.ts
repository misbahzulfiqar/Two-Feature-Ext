import { z } from "zod";

export const cronEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
});

export type CronEnv = z.infer<typeof cronEnvSchema>;
