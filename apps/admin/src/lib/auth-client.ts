import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { publicEnv } from "./env";

export const ACCESS_PATH = "/api/v1/access";

function authBaseUrl(): string {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return publicEnv().apiUrl;
}

export const authClient = createAuthClient({
  baseURL: authBaseUrl(),
  basePath: ACCESS_PATH,
  plugins: [adminClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export async function confirmSignedIn(): Promise<string | null> {
  const session = await authClient.getSession({
    query: { disableCookieCache: true },
    fetchOptions: { credentials: "include" },
  });
  if (session.error?.message) {
    return session.error.message;
  }
  if (!session.data?.user) {
    return "Login did not stay signed in. Keep the API running on port 3001.";
  }
  return null;
}

export function adminIdentityHeaders(): Record<string, string> {
  return {};
}
