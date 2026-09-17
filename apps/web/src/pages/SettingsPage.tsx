import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { GradientButton, SecondaryButton } from "../components/Buttons";
import { ChromeStoreInstallActions } from "../components/ChromeStoreInstallActions";
import { DashboardHeader } from "../components/DashboardPieces";
import { FormInput } from "../components/FormInput";
import { DarkCard, StatusBadge } from "../components/LayoutBits";
import { authClient } from "../lib/auth-client";
import { useSessionUser } from "../lib/session";
import { useExtensionInstall } from "../lib/use-extension-install";

export function SettingsPage() {
  const { name, email, createdAt } = useSessionUser();
  const navigate = useNavigate();
  const { installed, status, refresh } = useExtensionInstall();
  const [message, setMessage] = useState("");

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("current") ?? ""),
      newPassword: String(form.get("next") ?? ""),
    });
    setMessage(error?.message || "Password updated.");
  }

  async function logout() {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <AppShell name={name} email={email}>
      <DashboardHeader title="Settings" subtitle="Manage your profile, security, and extension." />
      <div className="grid gap-4 md:grid-cols-2">
        <DarkCard>
          <h2 className="font-bold">Profile</h2>
          <div className="mt-4 space-y-3">
            <FormInput label="Full Name" defaultValue={name} readOnly />
            <FormInput label="Email" defaultValue={email} readOnly />
          </div>
        </DarkCard>
        <DarkCard>
          <h2 className="font-bold">Security</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void onPassword(event)}>
            <FormInput label="Current password" name="current" type="password" required />
            <FormInput label="New password" name="next" type="password" minLength={8} required />
            <GradientButton type="submit">Change Password</GradientButton>
          </form>
          {message ? <p className="mt-2 text-sm text-mute">{message}</p> : null}
        </DarkCard>
        <DarkCard>
          <h2 className="font-bold">Extension</h2>
          <p className="mt-3">
            {installed ? (
              <StatusBadge tone="success">Connected {status?.version}</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Not Installed</StatusBadge>
            )}
          </p>
          <div className="mt-4">
            {installed ? (
              <SecondaryButton onClick={() => void refresh()}>Check Connection</SecondaryButton>
            ) : (
              <ChromeStoreInstallActions align="start" onCheck={() => void refresh()} />
            )}
          </div>
        </DarkCard>
        <DarkCard>
          <h2 className="font-bold">Account</h2>
          <p className="mt-2 text-sm text-mute">
            Joined {createdAt ? new Date(createdAt).toLocaleDateString() : "—"}
          </p>
          <SecondaryButton className="mt-4" onClick={() => void logout()}>
            Logout
          </SecondaryButton>
        </DarkCard>
      </div>
    </AppShell>
  );
}
