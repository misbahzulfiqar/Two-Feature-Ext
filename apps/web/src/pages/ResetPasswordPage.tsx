import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GradientButton } from "../components/Buttons";
import { FormInput } from "../components/FormInput";
import { authClient } from "../lib/auth-client";
import { authRequestError } from "../lib/auth-error";

export function ResetPasswordPage() {
  const [search] = useSearchParams();
  const token = search.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (authError) {
        setError(authError.message || "Could not reset password.");
        return;
      }
      setMessage("Password updated. You can sign in now.");
    } catch (error) {
      setError(authRequestError(error, "Could not reset password."));
    }
  }

  return (
    <AuthShell backHref="/login" backLabel="← Back to Login">
      <h1 className="text-xl font-extrabold">Reset password</h1>
      <p className="mt-1 text-sm text-mute">Choose a new password for your account.</p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <FormInput label="New password" name="password" type="password" minLength={8} required />
        <FormInput label="Confirm password" name="confirm" type="password" required />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-ok">{message}</p> : null}
        <GradientButton className="w-full" type="submit">
          Reset password
        </GradientButton>
      </form>
    </AuthShell>
  );
}
