import { z } from "zod";

export const scraperEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  REDIS_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  SCRAPER_WORKER_PORT: z.coerce.number().int().positive().default(3002),
  CHROME_EXECUTABLE_PATH: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
});

export type ScraperEnv = z.infer<typeof scraperEnvSchema>;
