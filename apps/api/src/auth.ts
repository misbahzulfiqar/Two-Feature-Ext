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

/**
 * Registrable domain of the API, as a cookie domain (".carvmax.com").
 *
 * The web app, admin and API live on sibling subdomains, so the session cookie
 * has to be set on the parent domain or the browser will not send it back.
 * Returns undefined for localhost/IP hosts, where subdomain cookies do not
 * apply and "secure" cookies would be dropped over http.
 */
function cookieDomain(env: ApiEnv): string | undefined {
  try {
    const host = new URL(env.API_BASE_URL).hostname;
    if (host === "localhost" || /^[0-9.]+$/.test(host)) {
      return undefined;
    }
    const labels = host.split(".");
    if (labels.length < 2) {
      return undefined;
    }
    return `.${labels.slice(-2).join(".")}`;
  } catch {
    return undefined;
  }
}

function trustedWebOrigins(env: ApiEnv): string[] {
  return [
    env.API_BASE_URL,
    env.WEB_APP_URL,
    env.ADMIN_APP_URL,
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    "http://localhost:3005",
    "http://127.0.0.1:3005",
    "https://extension.carvmax.com",
    "https://extension-admin.carvmax.com",
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
  const isProduction = env.NODE_ENV === "production";
  const crossSubDomain = cookieDomain(env);
  authLog.info(
    { isProduction, cookieDomain: crossSubDomain ?? "(host-only)" },
    "auth cookie policy",
  );

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
      // Sibling subdomains are a different site to the browser, and the
      // extension calls the API from a chrome-extension:// origin, so the
      // session cookie must be SameSite=None + Secure in production. Locally
      // that would be dropped over http, hence the split.
      ...(isProduction
        ? {
            crossSubDomainCookies: crossSubDomain
              ? { enabled: true, domain: crossSubDomain }
              : { enabled: false },
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
              httpOnly: true,
            },
          }
        : {
            defaultCookieAttributes: {
              sameSite: "lax" as const,
              secure: false,
            },
          }),
    },
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
