import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url(),
  ACCESS_SECRET: z
    .string()
    .min(32)
    .default("two-feature-access-9f3c1e7a4b8d26c0e5a1f7b3d9c4e8a2"),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default("aliraza81295@gmail.com"),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).default("aliraza81295###"),
  WEB_APP_URL: z.string().url().default("https://two-feature-ext-web.vercel.app"),
  EXTENSION_INSTALLED_URL: z
    .string()
    .url()
    .default("https://two-feature-ext-web.vercel.app/extension-installed"),
  SCRAPER_WORKER_URL: z.string().url().default("http://127.0.0.1:3003"),
  REDIS_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  MONGO_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().min(1).optional(),
  ),
  ADMIN_APP_URL: z.string().url().default("https://two-feature-ext-admin.vercel.app"),
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
