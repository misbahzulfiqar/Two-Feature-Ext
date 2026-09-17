import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { GradientButton, SecondaryButton } from "../components/Buttons";
import { ChromeStoreInstallActions } from "../components/ChromeStoreInstallActions";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProgressSteps } from "../components/DashboardPieces";
import { ChromeIcon } from "../components/Icons";
import { DarkCard, StatusBadge } from "../components/LayoutBits";
import { useSessionUser } from "../lib/session";
import { useExtensionInstall } from "../lib/use-extension-install";
import { useExtensionPairing } from "../lib/use-extension-pairing";

const STORE_STEPS = [
  ["Open the public listing", "Install from the Chrome Web Store. Anyone can Add to Chrome — no zip file."],
  ["Add to Chrome", "Click Add to Chrome, then Add extension."],
  ["Pin the icon", "Open the puzzle menu in Chrome and pin eBay Sell Similar."],
  ["Return here", "Come back and press Check Again. This site pairs the extension to your account."],
] as const;

export function InstallPage() {
  const { name, email } = useSessionUser();
  const navigate = useNavigate();
  const { installed, refresh } = useExtensionInstall();
  const [confirmOpen, setConfirmOpen] = useState(false);
  useExtensionPairing(installed);

  function next() {
    if (installed) {
      navigate("/onboarding/how-to-use");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <AppShell name={name} email={email}>
      <ProgressSteps step={1} total={3} />
      <h1 className="text-3xl font-extrabold">Install the Chrome Extension</h1>
      <p className="mt-2 text-mute">
        eBay Sell Similar is a public Chrome Web Store listing. Add it once, then use it on any
        Chrome browser where you are signed into this account.
      </p>
      <DarkCard className="mx-auto mt-8 max-w-2xl p-8 text-center">
        <div className="flex justify-center">
          <ChromeIcon className="h-16 w-16" />
        </div>
        <h2 className="mt-4 text-xl font-bold">eBay Sell Similar for Google Chrome</h2>
        {installed ? (
          <>
            <div className="mt-3">
              <StatusBadge tone="success">Extension Installed</StatusBadge>
            </div>
            <p className="mt-3 text-sm text-mute">eBay Sell Similar is installed and ready.</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-mute">
            Add the extension from the Chrome Web Store, then return here so we can connect it to
            this account.
          </p>
        )}
        <div className="mt-6">
          <ChromeStoreInstallActions onCheck={() => void refresh()} />
        </div>
      </DarkCard>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4 text-left md:grid-cols-2">
        {STORE_STEPS.map(([title, copy], index) => (
          <DarkCard key={title}>
            <h3 className="font-bold">
              {index + 1}. {title}
            </h3>
            <p className="mt-1 text-sm text-mute">{copy}</p>
          </DarkCard>
        ))}
      </div>
      <div className="mt-8 flex justify-between">
        <SecondaryButton href="/dashboard">Back to Dashboard</SecondaryButton>
        <GradientButton onClick={next}>Next Step →</GradientButton>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Extension not detected"
        message="We haven't detected the extension yet. Continue anyway?"
        confirmLabel="Continue anyway"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate("/onboarding/how-to-use");
        }}
      />
    </AppShell>
  );
}
