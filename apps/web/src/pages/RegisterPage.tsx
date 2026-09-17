import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GradientButton } from "../components/Buttons";
import { FormInput } from "../components/FormInput";
import { authClient } from "../lib/auth-client";
import { authRequestError } from "../lib/auth-error";

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const email = String(form.get("email") ?? "");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.get("terms") !== "on") {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name: String(form.get("name") ?? ""),
        email,
        password,
        callbackURL: `${window.location.origin}/onboarding/install`,
      });
      if (authError) {
        setError(authError.message || "Could not create the account");
        return;
      }
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (caught) {
      setError(authRequestError(caught, "Could not create the account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell backHref="/" backLabel="← Back to Home">
      <h1 className="text-xl font-extrabold">Create Account</h1>
      <p className="mt-1 text-sm text-mute">
        Create an account, then open the verification link before you sign in.
      </p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <FormInput label="Full Name" name="name" required />
        <FormInput label="Email" name="email" type="email" required />
        <FormInput label="Password" name="password" type="password" minLength={8} required />
        <FormInput label="Confirm Password" name="confirm" type="password" required />
        <label className="flex items-start gap-2 text-sm text-mute">
          <input name="terms" type="checkbox" className="mt-1" />
          I agree to the Terms of Service and Privacy Policy
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <GradientButton className="w-full" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </GradientButton>
      </form>
      <p className="mt-4 text-center text-sm text-mute">
        Already have an account?{" "}
        <Link to="/login" className="text-violet-bright">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
