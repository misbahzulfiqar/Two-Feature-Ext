import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GradientButton } from "../components/Buttons";
import { FormInput } from "../components/FormInput";
import { authClient, confirmSignedIn } from "../lib/auth-client";
import { authRequestError, isUnverifiedEmailError } from "../lib/auth-error";
import { isSignedInUser } from "../lib/session";

export function LoginPage() {
  const navigate = useNavigate();
  const { data, isPending } = authClient.useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isPending && isSignedInUser(data?.user)) {
    return <Navigate to="/onboarding/install" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const { error: authError } = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        rememberMe: form.get("remember") === "on",
      });
      if (authError) {
        const email = String(form.get("email") ?? "");
        if (isUnverifiedEmailError(authError)) {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
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
      navigate("/onboarding/install");
    } catch (caught) {
      setError(authRequestError(caught, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell backHref="/" backLabel="← Back to Home">
      <h1 className="text-xl font-extrabold">Welcome Back</h1>
      <p className="mt-1 text-sm text-mute">Login to continue and manage your account.</p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <FormInput label="Email" name="email" type="email" required placeholder="you@example.com" />
        <FormInput label="Password" name="password" type="password" required />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-mute">
            <input name="remember" type="checkbox" /> Remember me
          </label>
          <Link to="/forgot-password" className="text-violet-bright">
            Forgot password?
          </Link>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <GradientButton className="w-full" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </GradientButton>
      </form>
      <p className="mt-4 text-center text-sm text-mute">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="text-violet-bright">
          Create Account
        </Link>
      </p>
    </AuthShell>
  );
}
