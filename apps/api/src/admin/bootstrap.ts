import type { Auth } from "../auth.js";
import type { AppLogger } from "@sell-similar/logging";
import { USERS_COLLECTION, type AuthUserDoc } from "./types.js";
import { adminCollection } from "./db.js";

export async function bootstrapAdminAccount(input: {
  auth: Auth;
  mongoUrl: string;
  email: string;
  password: string;
  logger: AppLogger;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const users = await adminCollection<AuthUserDoc>(input.mongoUrl, USERS_COLLECTION);
  const existing = await users.findOne({ email });

  if (!existing) {
    const created = await input.auth.api.signUpEmail({
      body: {
        email,
        password: input.password,
        name: "Admin",
      },
    });
    if (!created?.user?.id) {
      input.logger.warn("Admin bootstrap signup did not return a user");
      return;
    }
    await users.updateOne(
      { id: created.user.id },
      { $set: { role: "admin", banned: false, emailVerified: true } },
    );
    input.logger.info({ email }, "Bootstrapped administrator account");
    return;
  }

  await users.updateOne(
    { id: existing.id },
    { $set: { role: "admin", banned: false, emailVerified: true } },
  );
  const context = await input.auth.$context;
  const hash = await context.password.hash(input.password);
  await context.internalAdapter.updatePassword(existing.id, hash);
  input.logger.info({ email }, "Ensured existing account is an administrator");
}
