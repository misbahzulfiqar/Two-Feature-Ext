import { getMongoClient } from "@sell-similar/ebay-models";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin } from "better-auth/plugins";
import { getAdminSettings } from "./admin/settings.js";
import type { ApiEnv } from "./env.js";
import { publicAuthUrl, rememberVerificationLink, sendAuthEmail } from "./mail.js";

export const ACCESS_PATH = "/api/v1/access";

let privilegedCreate = false;

/** Lets the admin bootstrap and the admin panel create accounts while public sign-up is closed. */
export async function runPrivilegedCreate<T>(task: () => Promise<T>): Promise<T> {
  privilegedCreate = true;
  try {
    return await task();
  } finally {
    privilegedCreate = false;
  }
}

function cookieDomain(env: ApiEnv): string | undefined {
  try {
    const host = new URL(env.API_BASE_URL).hostname;
    if (
      host === "localhost" ||
      /^[0-9.]+$/.test(host) ||
      host === "vercel.app" ||
      host.endsWith(".vercel.app")
    ) {
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
    "https://two-feature-ext-web.vercel.app",
    "https://two-feature-ext-admin.vercel.app",
    "https://two-feature-ext-api-jfyp.vercel.app",
  ];
}

export async function createAccess(env: ApiEnv) {
  if (!env.MONGO_URL) {
    throw new Error("Account sign-in needs MONGO_URL so accounts persist.");
  }

  const client = await getMongoClient(env.MONGO_URL);
  const db = client.db();
  const mongoUrl = env.MONGO_URL;
  const bootstrapEmail = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  const isProduction = env.NODE_ENV === "production";
  const crossSubDomain = cookieDomain(env);

  return betterAuth({
    secret: env.ACCESS_SECRET,
    baseURL: env.API_BASE_URL,
    basePath: ACCESS_PATH,
    trustedOrigins: [...new Set(trustedWebOrigins(env))],
    database: mongodbAdapter(db, { client, transaction: false }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail(env, {
          to: user.email,
          subject: "Reset your eBay Sell Similar password",
          text: `Click this link to choose a new password:\n${publicAuthUrl(env, url)}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
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
            const email = String(user.email ?? "").trim().toLowerCase();
            if (!privilegedCreate && email !== bootstrapEmail) {
              const settings = await getAdminSettings(mongoUrl).catch(() => null);
              if (settings && !settings.features.registrationEnabled) {
                throw new APIError("BAD_REQUEST", {
                  message: "Registration is currently disabled.",
                });
              }
            }
            return { data: { ...user, emailVerified: true } };
          },
        },
      },
    },
    advanced: {
      cookiePrefix: "two-feature-access",
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

export type AccessAuth = Awaited<ReturnType<typeof createAccess>>;
