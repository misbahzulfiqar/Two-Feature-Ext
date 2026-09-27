type SessionUser = {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  createdAt?: string | Date;
};

type SessionData = {
  user?: SessionUser;
} | null;

const off = { message: "Accounts are turned off. Download the extension and use it on eBay." };

function idleSession() {
  return { data: null as SessionData, error: null, isPending: false };
}

type AuthResult = { error: { message: string } | null };

async function rejected(_input?: unknown): Promise<AuthResult> {
  return { error: off };
}

async function accepted(_input?: unknown): Promise<AuthResult> {
  return { error: null };
}

/** Accounts are not used. Scrape and fill do not sign in. */
export const authClient = {
  useSession: idleSession,
  getSession: async (_input?: unknown) => idleSession(),
  signOut: async () => undefined,
  signIn: { email: rejected },
  signUp: { email: rejected },
  requestPasswordReset: accepted,
  resetPassword: accepted,
  changePassword: rejected,
  sendVerificationEmail: rejected,
};

export async function confirmSignedIn(): Promise<string | null> {
  return off.message;
}
