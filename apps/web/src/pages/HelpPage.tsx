import { AppShell } from "../components/AppShell";
import { DashboardHeader } from "../components/DashboardPieces";
import { DarkCard } from "../components/LayoutBits";
import { useSessionUser } from "../lib/session";

const CARDS = [
  [
    "Getting Started",
    "Create a free account, sign in, then download the extension from your dashboard and load it into Chrome.",
  ],
  [
    "Installing the Extension",
    "Download the zip, unzip it, open chrome://extensions, turn on Developer mode, then Load unpacked and pick the unzipped folder.",
  ],
  ["Full Scrape", "Copies title, photos, specifics, description, and compatibility when enabled."],
  ["Fitment Only", "Scrapes vehicle compatibility only and leaves other fields alone."],
  [
    "Troubleshooting",
    "If the panel is missing, reload the listing editor, confirm the extension is enabled, and pin it from Chrome’s puzzle menu.",
  ],
  ["Contact Support", "Use this Help page until a support inbox is configured."],
] as const;

const FAQS = [
  [
    "Why is my extension not detected?",
    "After Load unpacked, return here and press Check Again. If it still is not detected, confirm the extension is enabled on chrome://extensions and that you selected the folder containing manifest.json.",
  ],
  [
    "Is the extension public?",
    "The extension is distributed directly to customers rather than through the Chrome Web Store. Sign in, download it from your dashboard, and signing in here pairs that install with your account.",
  ],
  [
    "Why does the extension need authentication?",
    "Pairing ties the installed extension to your eBay Sell Similar account using a short-lived one-time token. The website never copies your login cookies into eBay pages.",
  ],
  [
    "What is Full Scrape?",
    "Full Scrape copies supported listing details from a source item so you can review them on Create or Edit Listing.",
  ],
  [
    "What is Fitment Only?",
    "Fitment Only scrapes vehicle compatibility data and skips the rest of the listing fields.",
  ],
  [
    "Does eBay Sell Similar publish listings automatically?",
    "No. It populates supported listing data, but the seller reviews the listing and uses eBay’s native List/Revise action.",
  ],
] as const;

export function HelpPage() {
  const { name, email } = useSessionUser();
  return (
    <AppShell name={name} email={email}>
      <DashboardHeader title="How can we help?" subtitle="Guides for the extension and your account." />
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map(([title, copy]) => (
          <DarkCard key={title}>
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm text-mute">{copy}</p>
          </DarkCard>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {FAQS.map(([title, copy]) => (
          <DarkCard key={title}>
            <h3 className="font-bold">{title}</h3>
            <p className="mt-2 text-sm text-mute">{copy}</p>
          </DarkCard>
        ))}
      </div>
    </AppShell>
  );
}
