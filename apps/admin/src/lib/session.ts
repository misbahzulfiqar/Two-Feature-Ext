import { authClient } from "./auth-client";

export type SessionUser = {
  name: string;
  email: string;
  createdAt?: string;
};

export function isAdminSessionUser(
  user: { role?: string | null; emailVerified?: boolean | null } | null | undefined,
): boolean {
  if (!user || user.emailVerified === false) {
    return false;
  }
  return String(user.role ?? "") === "admin";
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
