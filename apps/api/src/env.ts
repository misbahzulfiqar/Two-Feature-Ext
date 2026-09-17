import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_APP_URL: z.string().url().default("http://127.0.0.1:3004"),
  EXTENSION_INSTALLED_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3004/extension-installed"),
  SCRAPER_WORKER_URL: z.string().url().default("http://127.0.0.1:3003"),
  REDIS_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  MONGO_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  ADMIN_BOOTSTRAP_EMAIL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().email().optional(),
  ),
  ADMIN_BOOTSTRAP_PASSWORD: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(8).optional(),
  ),
  ADMIN_APP_URL: z.string().url().default("http://127.0.0.1:3005"),
  EMAIL_FROM: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  SMTP_HOST: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  SMTP_PORT: z.preprocess(
    (value) => (value === "" || value === undefined ? 587 : value),
    z.coerce.number().int().positive(),
  ),
  SMTP_USER: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  SMTP_PASS: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
