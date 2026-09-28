import type { AppLogger } from "@sell-similar/logging";
import { runPrivilegedCreate, type AccessAuth } from "../access.js";
import { adminCollection } from "./db.js";
import { USERS_COLLECTION, type AuthUserDoc } from "./types.js";

export async function ensureAdminAccount(input: {
  auth: AccessAuth;
  mongoUrl: string;
  email: string;
  password: string;
  logger: AppLogger;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const users = await adminCollection<AuthUserDoc>(input.mongoUrl, USERS_COLLECTION);
  let existing = await users.findOne({ email });

  if (!existing) {
    try {
      await runPrivilegedCreate(() =>
        input.auth.api.signUpEmail({
          body: {
            email,
            password: input.password,
            name: "Admin",
          },
        }),
      );
    } catch (error) {
      input.logger.warn(
        { err: error instanceof Error ? error.message : "signup failed" },
        "admin account signup",
      );
    }
    existing = await users.findOne({ email });
  }

  if (!existing?.id) {
    input.logger.warn({ email }, "Admin account was not created");
    return;
  }

  await users.updateOne(
    { id: existing.id },
    { $set: { role: "admin", banned: false, emailVerified: true } },
  );
  const context = await input.auth.$context;
  const hash = await context.password.hash(input.password);
  await context.internalAdapter.updatePassword(existing.id, hash);
  input.logger.info({ email }, "Administrator account is ready");
}
