import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GradientButton } from "../components/Buttons";
import { authClient } from "../lib/auth-client";
import { authRequestError } from "../lib/auth-error";

type VerificationLinkResponse = {
  url?: string | null;
  mailEnabled?: boolean;
};

async function loadVerificationLink(
  email: string,
): Promise<{ url: string | null; mailEnabled: boolean }> {
  if (!email) {
    return { url: null, mailEnabled: false };
  }
  const response = await fetch(
    `/api/v1/verification-link?email=${encodeURIComponent(email)}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    return { url: null, mailEnabled: false };
  }
  const body = (await response.json()) as VerificationLinkResponse;
  return {
    url: body.url ?? null,
    mailEnabled: Boolean(body.mailEnabled),
  };
}

export function VerifyEmailPage() {
  const [search] = useSearchParams();
  const email = search.get("email") ?? "";
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [mailEnabled, setMailEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadVerificationLink(email).then((result) => {
      if (cancelled) {
        return;
      }
      setVerifyUrl(result.url);
      setMailEnabled(result.mailEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    if (!email) {
      setError("Enter your email on the login page to resend the link.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: authError } = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/onboarding/install`,
      });
      if (authError) {
        setError(authError.message || "Could not send a verification email.");
        return;
      }
      const result = await loadVerificationLink(email);
      setVerifyUrl(result.url);
      setMailEnabled(result.mailEnabled);
      if (result.url) {
        setMessage("Click Verify email. You do not need Gmail for this.");
        return;
      }
      if (result.mailEnabled) {
        setMessage("If mail is configured, check that inbox for the link.");
        return;
      }
      setMessage(
        "No new link was created. This email is probably already verified — use Login.",
      );
    } catch (caught) {
      setError(authRequestError(caught, "Could not send a verification email."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell backHref="/login" backLabel="← Back to Login">
      <h1 className="text-xl font-extrabold">Verify your email</h1>
      <p className="mt-1 text-sm text-mute">
        {verifyUrl
          ? "Click Verify email below. That opens Better Auth’s verify link."
          : mailEnabled
            ? `If an email was sent to ${email || "your address"}, open the link in that message.`
            : "Gmail is not connected. Click Resend to show a Verify email button on this page."}
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-ok">{message}</p> : null}
      {verifyUrl ? (
        <GradientButton className="mt-4 w-full" href={verifyUrl}>
          Verify email
        </GradientButton>
      ) : null}
      <form className={verifyUrl ? "mt-3" : "mt-4"} onSubmit={(event) => void resend(event)}>
        <GradientButton className="w-full" type="submit" disabled={loading || !email}>
          {loading ? "Sending..." : "Resend verification link"}
        </GradientButton>
      </form>
      <p className="mt-4 text-center text-sm text-mute">
        Already verified?{" "}
        <Link to="/login" className="text-violet-bright">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
