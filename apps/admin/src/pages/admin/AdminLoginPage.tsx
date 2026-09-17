import { type FormEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { authClient, confirmSignedIn } from "../../lib/auth-client";
import { authRequestError, isUnverifiedEmailError } from "../../lib/auth-error";
import { isAdminSessionUser } from "../../lib/session";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.8 3.2M9.9 5.1A10.5 10.5 0 0 1 12 5c5.5 0 9.5 4.5 10.5 7-.4.9-1.1 2-2.1 3.1M6.1 6.2C4.4 7.5 3.2 9.1 2.5 12 3.5 14.5 7.5 19 12 19c1.4 0 2.7-.4 3.9-1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M2.5 12C3.5 9.5 7.5 5 12 5s8.5 4.5 9.5 7c-1 2.5-5 7-9.5 7s-8.5-4.5-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function nextAdminPath(callbackUrl: string | null): string {
  if (callbackUrl?.startsWith("/admin") && callbackUrl !== "/admin/login") {
    return callbackUrl;
  }
  return "/admin";
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { data, isPending } = authClient.useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050914] text-mute">
        Loading...
      </div>
    );
  }

  if (isAdminSessionUser(data?.user)) {
    return <Navigate to={nextAdminPath(search.get("callbackUrl"))} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const { error: authError } = await authClient.signIn.email({
        email,
        password: String(form.get("password") ?? ""),
        rememberMe: form.get("remember") === "on",
      });
      if (authError) {
        if (isUnverifiedEmailError(authError)) {
          setUnverifiedEmail(email);
          setError("Verify your email first. We sent a new link if this admin account exists.");
          return;
        }
        setError(authError.message || "Invalid email or password.");
        return;
      }
      const sessionError = await confirmSignedIn();
      if (sessionError) {
        setError(sessionError);
        return;
      }
      const session = await authClient.getSession({
        query: { disableCookieCache: true },
        fetchOptions: { credentials: "include" },
      });
      if (!isAdminSessionUser(session.data?.user)) {
        await authClient.signOut();
        setError("This account is not an administrator.");
        return;
      }
      navigate(nextAdminPath(search.get("callbackUrl")), { replace: true });
    } catch (caught) {
      setError(authRequestError(caught, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050914] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_50%_0%,#3b1d8a55,transparent)]" />
      <div className="relative w-full max-w-[400px] rounded-[16px] border border-line bg-admin-card p-6 shadow-cta sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png?v=4" alt="" className="h-11 w-11 object-contain" />
          <div>
            <p className="text-base font-extrabold leading-tight">eBay Sell Similar</p>
            <span className="mt-1 inline-flex rounded-full bg-violet/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-bright">
              Admin
            </span>
          </div>
        </div>
        <h1 className="text-xl font-extrabold">Admin sign in</h1>
        <p className="mt-1 text-sm text-mute">Use your administrator account to open the panel.</p>
        <form className="mt-5 space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-left">
            <span className="mb-1 block text-xs font-medium text-mute">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@example.com"
              className="h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-violet-bright"
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-xs font-medium text-mute">Password</span>
            <span className="relative block">
              <input
                name="password"
                type={passwordVisible ? "text" : "password"}
                required
                autoComplete="current-password"
                className="h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 pr-10 text-sm text-ink outline-none placeholder:text-faint focus:border-violet-bright"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-mute hover:text-ink"
                onClick={() => setPasswordVisible((open) => !open)}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
              >
                <PasswordVisibilityIcon visible={passwordVisible} />
              </button>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-mute">
            <input name="remember" type="checkbox" /> Remember me
          </label>
          {error ? <p className="text-sm text-[#ef4444]">{error}</p> : null}
          {unverifiedEmail ? (
            <button
              className="w-full text-sm font-semibold text-violet-bright"
              type="button"
              onClick={() => {
                void authClient
                  .sendVerificationEmail({
                    email: unverifiedEmail,
                    callbackURL: `${window.location.origin}/admin`,
                  })
                  .then(({ error: sendError }) => {
                    setError(
                      sendError?.message ||
                        "Open the verification link, then sign in again.",
                    );
                  });
              }}
            >
              Resend verification link
            </button>
          ) : null}
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-btn text-sm font-semibold text-white shadow-cta disabled:opacity-50"
            style={{ backgroundImage: "var(--ss-cta)" }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
