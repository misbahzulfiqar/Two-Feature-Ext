import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SecondaryButton } from "../components/Buttons";
import { ExtensionDownloadActions } from "../components/ExtensionDownloadActions";
import { ProgressSteps } from "../components/DashboardPieces";
import { DarkCard } from "../components/LayoutBits";
import { SetupChecklist } from "../components/ProductCards";
import { publicEnv } from "../lib/env";
import { useSessionUser } from "../lib/session";
import { useExtensionInstall } from "../lib/use-extension-install";
import { useExtensionPairing } from "../lib/use-extension-pairing";

export function ReadyPage() {
  const { name, email } = useSessionUser();
  const { installed, refresh } = useExtensionInstall();
  const env = publicEnv();
  useExtensionPairing(installed);
  return (
    <AppShell name={name} email={email}>
      <ProgressSteps step={3} total={3} />
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ok text-3xl text-white">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">You&apos;re All Set!</h1>
        <p className="mt-2 text-mute">
          The extension is ready to scrape and fill on eBay
          {installed ? " and it is installed in this browser." : "."}
        </p>
        <DarkCard className="mt-8 text-left">
          <SetupChecklist
            items={[
              { ok: true, label: "No account needed" },
              {
                ok: installed,
                label: installed
                  ? "Chrome extension installed"
                  : "Chrome extension not detected",
              },
              { ok: true, label: "Ready to use inside eBay" },
            ]}
          />
          {!installed ? (
            <div className="mt-4">
              <ExtensionDownloadActions align="start" onCheck={() => void refresh()} />
            </div>
          ) : null}
        </DarkCard>
        <div className="mt-6">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-btn px-5 py-2.5 text-sm font-semibold text-white shadow-cta"
            style={{ backgroundImage: "var(--ss-cta)" }}
            href={env.ebaySellUrl}
            target="_blank"
            rel="noreferrer"
          >
            Go to eBay and Start Listing
          </a>
        </div>
        <DarkCard className="mt-6 text-left">
          <h2 className="font-bold">Need Help?</h2>
          <p className="mt-1 text-sm text-mute">Check our Help Center or contact support anytime.</p>
          <Link to="/help" className="mt-2 inline-block text-sm text-violet-bright">
            View Help Center →
          </Link>
        </DarkCard>
        <div className="mt-6">
          <SecondaryButton href="/dashboard">← Back to Dashboard</SecondaryButton>
        </div>
      </div>
    </AppShell>
  );
}
