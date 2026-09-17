import { type FormEvent, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { GradientButton } from "../components/Buttons";
import { FormInput } from "../components/FormInput";
import { authClient } from "../lib/auth-client";
import { authRequestError } from "../lib/auth-error";

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: String(form.get("email") ?? ""),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (authError) {
        setError(
          authError.message ||
            "Password reset email is not configured yet. Contact support if you cannot sign in.",
        );
        return;
      }
      setMessage("If that account exists and email is configured, a reset link was sent.");
    } catch (error) {
      setError(authRequestError(error, "Could not send a reset link."));
    }
  }

  return (
    <AuthShell backHref="/login" backLabel="← Back to Login">
      <h1 className="text-xl font-extrabold">Forgot password</h1>
      <p className="mt-1 text-sm text-mute">Enter your email to receive a reset link if email is enabled.</p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <FormInput label="Email" name="email" type="email" required />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-ok">{message}</p> : null}
        <GradientButton className="w-full" type="submit">
          Send reset link
        </GradientButton>
      </form>
    </AuthShell>
  );
}
