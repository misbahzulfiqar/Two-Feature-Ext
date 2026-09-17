import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DashboardHeader, StatCard } from "../components/DashboardPieces";
import { DarkCard } from "../components/LayoutBits";
import { ActivityTable, ChromeExtensionCard } from "../components/ProductCards";
import { fetchActivity, type ActivitySummary } from "../lib/activity";
import { dayGreeting, firstName } from "../lib/greet";
import { useSessionUser } from "../lib/session";
import { useExtensionInstall } from "../lib/use-extension-install";
import { useExtensionPairing } from "../lib/use-extension-pairing";

export function DashboardPage() {
  const { name, email } = useSessionUser();
  const { installed, status, refresh } = useExtensionInstall();
  const [greeting, setGreeting] = useState("Hello");
  const [activity, setActivity] = useState<ActivitySummary>({
    listingsToday: 0,
    totalListings: 0,
    hoursSaved: 0,
    successRate: null,
    jobs: [],
  });

  useExtensionPairing(installed);

  useEffect(() => {
    setGreeting(dayGreeting());
    void fetchActivity().then(setActivity);
  }, []);

  return (
    <AppShell name={name} email={email}>
      <DashboardHeader
        title={`${greeting}, ${firstName(name)}! 👋`}
        subtitle="Let's create more listings and save time today."
      />
      <ChromeExtensionCard
        installed={installed}
        version={status?.version}
        onCheck={() => {
          void refresh();
        }}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Listings Today" value={String(activity.listingsToday)} />
        <StatCard label="Total Listings" value={String(activity.totalListings)} />
        <StatCard label="Hours Saved" value={String(activity.hoursSaved)} />
        <StatCard
          label="Success Rate"
          value={activity.successRate == null ? "—" : `${activity.successRate}%`}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <DarkCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent Activity</h2>
            <Link to="/history" className="text-sm text-mute">
              View All
            </Link>
          </div>
          <ActivityTable rows={activity.jobs} />
        </DarkCard>
        <DarkCard>
          <h2 className="mb-3 font-bold">Quick Links</h2>
          <ul className="space-y-3 text-sm">
            <li>
              <Link to="/onboarding/install">Install Extension</Link>
            </li>
            <li>
              <Link to="/onboarding/how-to-use">How to Use</Link>
            </li>
            <li>
              <Link to="/settings">Account Settings</Link>
            </li>
            <li>
              <Link to="/help">Help &amp; Support</Link>
            </li>
          </ul>
        </DarkCard>
      </div>
    </AppShell>
  );
}
