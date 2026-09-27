import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { GradientButton, SecondaryButton } from "../components/Buttons";
import { ExtensionDownloadActions } from "../components/ExtensionDownloadActions";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProgressSteps } from "../components/DashboardPieces";
import { ChromeIcon } from "../components/Icons";
import { DarkCard, StatusBadge } from "../components/LayoutBits";
import { useSessionUser } from "../lib/session";
import { useExtensionInstall } from "../lib/use-extension-install";
import { useExtensionPairing } from "../lib/use-extension-pairing";

const STORE_STEPS = [
  [
    "Download and unzip",
    "Press Download extension above, then unzip the file. Keep the unzipped folder somewhere permanent — Chrome loads the extension from that folder every time it starts, so deleting it uninstalls the extension.",
  ],
  [
    "Open chrome://extensions",
    "Paste chrome://extensions into your address bar and press Enter. Then turn on Developer mode using the switch in the top-right corner.",
  ],
  [
    "Load unpacked",
    "Click Load unpacked, then select the unzipped folder — the one containing manifest.json. eBay Sell Similar now appears in your extensions list.",
  ],
  [
    "Pin it and come back",
    "Open Chrome's puzzle-piece menu and pin eBay Sell Similar so it stays visible. Then open an eBay Create or Edit Listing page and use the panel.",
  ],
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
        eBay Sell Similar is distributed directly to customers. Download the build below, load it
        into Chrome once, and it stays installed on this browser.
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
            Download the extension and load it into Chrome using the steps below. No account is
            required.
          </p>
        )}
        <div className="mt-6">
          <ExtensionDownloadActions onCheck={() => void refresh()} />
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
