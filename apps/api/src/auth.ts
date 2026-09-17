import { getMongoClient } from "@sell-similar/ebay-models";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin } from "better-auth/plugins";
import { createLogger } from "@sell-similar/logging";
import type { ApiEnv } from "./env.js";
import { getAdminSettings } from "./admin/settings.js";
import { sendAuthEmail, publicAuthUrl, rememberVerificationLink } from "./mail.js";

const authLog = createLogger({ name: "auth" });

function trustedWebOrigins(env: ApiEnv): string[] {
  return [
    env.API_BASE_URL,
    env.WEB_APP_URL,
    env.ADMIN_APP_URL,
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    "http://localhost:3005",
    "http://127.0.0.1:3005",
    "https://ebaysellsimilar.com",
    "https://www.ebaysellsimilar.com",
    "https://app.ebaysellsimilar.com",
  ];
}

export async function createAuth(env: ApiEnv) {
  if (!env.MONGO_URL) {
    throw new Error(
      "BETTER_AUTH email/password needs MONGO_URL so accounts persist. Set it in the root .env.",
    );
  }

  const client = await getMongoClient(env.MONGO_URL);
  const db = client.db();
  const mongoUrl = env.MONGO_URL;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    trustedOrigins: [...new Set(trustedWebOrigins(env))],
    database: mongodbAdapter(db, { client, transaction: false }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: false,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail(env, {
          to: user.email,
          subject: "Reset your eBay Sell Similar password",
          text: `Click this link to choose a new password:\n${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const link = publicAuthUrl(env, url);
        rememberVerificationLink(user.email, link);
        await sendAuthEmail(env, {
          to: user.email,
          subject: "Verify your eBay Sell Similar email",
          text: link,
        });
      },
      afterEmailVerification: async (user) => {
        authLog.info({ email: user.email }, "Email verified; account can sign in");
      },
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        bannedUserMessage: "This account has been disabled.",
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const settings = await getAdminSettings(mongoUrl);
            if (!settings.features.registrationEnabled) {
              throw new APIError("BAD_REQUEST", {
                message: "Registration is currently disabled.",
              });
            }
            return { data: user };
          },
        },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: false,
      },
    },
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
