import { AppShell } from "../components/AppShell";
import { GradientButton, SecondaryButton } from "../components/Buttons";
import { ProgressSteps } from "../components/DashboardPieces";
import { DarkCard } from "../components/LayoutBits";
import { useSessionUser } from "../lib/session";

const STEPS = [
  ["Pin the extension", "Click Chrome’s puzzle icon and pin eBay Sell Similar so it stays on the toolbar."],
  ["Open eBay Create/Edit Listing", "Go to eBay and open the Create Listing or Edit Listing page."],
  ["Open the panel", "Click the eBay Sell Similar icon. The panel appears inside eBay’s listing editor."],
  ["Enter Source Item", "Paste the eBay Item ID or URL you want to copy."],
  ["Choose Mode", "Select Full Scrape or Fitment Only."],
  ["Process", "Click Process and watch the live progress."],
  ["Review & List", "The eBay form will be populated. Review it and use eBay’s own List/Revise button when ready."],
] as const;

export function HowToUsePage() {
  const { name, email } = useSessionUser();
  return (
    <AppShell name={name} email={email}>
      <ProgressSteps step={2} total={3} />
      <h1 className="text-3xl font-extrabold">How to Use</h1>
      <p className="mt-2 text-mute">
        Follow these simple steps to create new listings faster inside eBay.
      </p>
      <div className="mt-8 space-y-3">
        {STEPS.map(([title, copy], index) => (
          <DarkCard key={title} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[image:var(--ss-cta)] text-sm font-bold">
              {index + 1}
            </span>
            <div>
              <h2 className="font-bold">{title}</h2>
              <p className="mt-1 text-sm text-mute">{copy}</p>
            </div>
          </DarkCard>
        ))}
      </div>
      <p className="mt-6 rounded-card border border-line bg-card p-4 text-sm text-mute">
        eBay Sell Similar does not automatically submit the final listing.
      </p>
      <div className="mt-8 flex justify-between">
        <SecondaryButton href="/onboarding/install">← Back</SecondaryButton>
        <GradientButton href="/onboarding/ready">Next Step →</GradientButton>
      </div>
    </AppShell>
  );
}
