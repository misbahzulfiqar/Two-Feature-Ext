import { authClient } from "./auth-client";

export type SessionUser = {
  name: string;
  email: string;
  createdAt?: string;
};

const AFTER_LOGIN_PREFIXES = [
  "/dashboard",
  "/history",
  "/settings",
  "/help",
  "/onboarding",
] as const;

export function postLoginPath(callbackUrl: string | null | undefined): string {
  if (
    !callbackUrl ||
    callbackUrl === "/" ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//")
  ) {
    return "/dashboard";
  }
  if (
    AFTER_LOGIN_PREFIXES.some(
      (prefix) => callbackUrl === prefix || callbackUrl.startsWith(`${prefix}/`),
    )
  ) {
    return callbackUrl;
  }
  return "/dashboard";
}

export function isSignedInUser(
  user: { emailVerified?: boolean | null } | null | undefined,
): boolean {
  return Boolean(user) && user?.emailVerified !== false;
}

export function useSessionUser(): SessionUser {
  const { data } = authClient.useSession();
  const user = data?.user;
  return {
    name: user?.name?.trim() || user?.email?.split("@")[0] || "there",
    email: user?.email ?? "",
    createdAt:
      typeof user?.createdAt === "string"
        ? user.createdAt
        : user?.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : undefined,
  };
}
