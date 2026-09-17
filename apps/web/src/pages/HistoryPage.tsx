import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { DashboardHeader } from "../components/DashboardPieces";
import { DarkCard } from "../components/LayoutBits";
import { ActivityTable } from "../components/ProductCards";
import { fetchActivity, type ActivityJob } from "../lib/activity";
import { useSessionUser } from "../lib/session";

const MODE_FILTERS = ["All", "Full Scrape", "Fitment Only"] as const;
const STATUS_FILTERS = ["All", "Completed", "Processing", "Failed"] as const;

export function HistoryPage() {
  const { name, email } = useSessionUser();
  const [jobs, setJobs] = useState<ActivityJob[]>([]);
  const [mode, setMode] = useState<(typeof MODE_FILTERS)[number]>("All");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetchActivity().then((activity) => setJobs(activity.jobs));
  }, []);

  const rows = useMemo(
    () =>
      jobs.filter((job) => {
        const modeOk = mode === "All" || job.mode === mode;
        const statusOk = status === "All" || job.status === status;
        const queryOk =
          !query.trim() || job.itemId.toLowerCase().includes(query.trim().toLowerCase());
        return modeOk && statusOk && queryOk;
      }),
    [jobs, mode, query, status],
  );

  return (
    <AppShell name={name} email={email}>
      <DashboardHeader
        title="Activity History"
        subtitle="Review your recent eBay Sell Similar processing activity."
      />
      <DarkCard>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            {MODE_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-btn border px-3 py-1.5 ${mode === item ? "border-violet-bright text-ink" : "border-line text-mute"}`}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-btn border px-3 py-1.5 ${status === item ? "border-violet-bright text-ink" : "border-line text-mute"}`}
                onClick={() => setStatus(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Item ID"
          className="mb-4 h-11 w-full rounded-field border border-line bg-card-2 px-3 text-sm outline-none focus:border-violet-bright"
        />
        <ActivityTable rows={rows} variant="history" />
      </DarkCard>
    </AppShell>
  );
}
