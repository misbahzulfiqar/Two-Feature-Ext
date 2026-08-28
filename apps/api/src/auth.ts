import { betterAuth } from "better-auth";
import type { ApiEnv } from "./env.js";

export function createAuth(env: ApiEnv) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.API_BASE_URL],
  });
}

export type Auth = ReturnType<typeof createAuth>;
