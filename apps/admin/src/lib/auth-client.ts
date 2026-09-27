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

const off = { message: "Admin sign-in is turned off." };

function idleSession() {
  return { data: null as SessionData, error: null, isPending: false };
}

type AuthResult = { error: { message: string } | null };

async function rejected(_input?: unknown): Promise<AuthResult> {
  return { error: off };
}

export const authClient = {
  useSession: idleSession,
  getSession: async (_input?: unknown) => idleSession(),
  signOut: async () => undefined,
  signIn: { email: rejected },
  changePassword: rejected,
  sendVerificationEmail: rejected,
};

export async function confirmSignedIn(): Promise<string | null> {
  return off.message;
}
