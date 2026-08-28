import type { z } from "zod";

export class EnvValidationError extends Error {
  override readonly name = "EnvValidationError";

  constructor(readonly details: string) {
    super(`Invalid environment configuration:\n${details}`);
  }
}

export function loadEnv<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new EnvValidationError(result.error.message);
  }
  return result.data;
}
