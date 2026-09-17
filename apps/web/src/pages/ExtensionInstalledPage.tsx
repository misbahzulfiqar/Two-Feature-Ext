import { AppLogo } from "../components/AppLogo";
import { GradientButton, SecondaryButton } from "../components/Buttons";
import { DarkCard, StatusBadge } from "../components/LayoutBits";
import { publicEnv } from "../lib/env";
import { useExtensionInstall } from "../lib/use-extension-install";
import { useExtensionPairing } from "../lib/use-extension-pairing";

export function ExtensionInstalledPage() {
  const { installed, status, refresh } = useExtensionInstall();
  const env = publicEnv();
  useExtensionPairing(installed);
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-page px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_50%_0%,#3b1d8a55,transparent)]" />
      <div className="relative">
        <AppLogo />
        <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full bg-ok text-3xl text-white">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">Extension Installed Successfully</h1>
        <p className="mt-2 max-w-lg text-mute">eBay Sell Similar is now installed in Chrome.</p>
        <DarkCard className="mt-8 w-full max-w-lg">
          {installed ? (
            <StatusBadge tone="success">
              Extension Connected {status?.version ? `v${status.version}` : ""}
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">Waiting for detection</StatusBadge>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <GradientButton href="/dashboard">Continue to Dashboard</GradientButton>
            <a
              className="inline-flex min-h-11 items-center rounded-btn border border-line px-5 text-sm font-semibold"
              href={env.ebaySellUrl}
              target="_blank"
              rel="noreferrer"
            >
              Go to eBay & Start Listing
            </a>
            <SecondaryButton onClick={() => void refresh()}>Check Again</SecondaryButton>
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
