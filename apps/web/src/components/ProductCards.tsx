import { Link } from "react-router-dom";
import { publicEnv } from "../lib/env";
import { SecondaryButton } from "./Buttons";
import { ChromeStoreInstallActions } from "./ChromeStoreInstallActions";
import { ChromeIcon, PuzzleIcon } from "./Icons";
import { DarkCard, StatusBadge } from "./LayoutBits";

export function ChromeExtensionCard({
  installed,
  version,
  onCheck,
}: {
  installed: boolean;
  version?: string;
  onCheck: () => void;
}) {
  return (
    <DarkCard className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex-1">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-card-2">
            <ChromeIcon className="h-10 w-10" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">Your Extension</h2>
              {installed ? (
                <StatusBadge tone="success">Extension Connected</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Not Installed</StatusBadge>
              )}
            </div>
            <p className="mt-2 max-w-xl text-sm text-mute">
              {installed
                ? `eBay Sell Similar ${version ? `v${version}` : ""} is installed and ready inside eBay’s listing editor.`
                : "Install eBay Sell Similar from the public Chrome Web Store, then return here to connect it to this account."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {installed ? (
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-5 py-2.5 text-sm font-semibold text-white shadow-cta transition duration-200 hover:-translate-y-0.5"
                style={{ backgroundImage: "var(--ss-cta)" }}
                href={publicEnv().ebaySellUrl}
                target="_blank"
                rel="noreferrer"
              >
                Go to eBay & Start Listing
              </a>
              <SecondaryButton href="/onboarding/how-to-use">How It Works</SecondaryButton>
              <SecondaryButton onClick={onCheck}>Check Again</SecondaryButton>
            </div>
          ) : (
            <>
              <ChromeStoreInstallActions
                align="start"
                installLabel="Install Chrome Extension"
                onCheck={onCheck}
              />
              <SecondaryButton href="/onboarding/how-to-use">How It Works</SecondaryButton>
            </>
          )}
        </div>
      </div>
      <div className="hidden shrink-0 md:block">
        <PuzzleIcon className="h-24 w-24 opacity-90" />
      </div>
    </DarkCard>
  );
}

export function SetupChecklist({
  items,
}: {
  items: Array<{ ok: boolean; label: string }>;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3 text-sm">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full ${item.ok ? "bg-ok text-white" : "bg-card-2 text-mute"}`}
          >
            {item.ok ? "✓" : "!"}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type ActivityRow = {
  jobId: string;
  itemId: string;
  mode: string;
  status: string;
  progress?: string;
  fitment?: string;
  images?: string;
  duration?: string;
  date: string;
};

export function ActivityTable({
  rows,
  variant = "dashboard",
}: {
  rows: ActivityRow[];
  variant?: "dashboard" | "history";
}) {
  const history = variant === "history";
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-mute">
          <tr>
            <th className="px-3 py-2 font-medium">Item ID</th>
            <th className="px-3 py-2 font-medium">Mode</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {history ? (
              <>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 font-medium">Fitment</th>
                <th className="px-3 py-2 font-medium">Images</th>
                <th className="px-3 py-2 font-medium">Duration</th>
              </>
            ) : null}
            <th className="px-3 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-mute" colSpan={history ? 8 : 4}>
                No listings processed yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.jobId} className="border-t border-line">
                <td className="px-3 py-3 font-medium">
                  <Link to={`/history/${row.jobId}`} className="hover:text-violet-bright">
                    {row.itemId}
                  </Link>
                </td>
                <td className="px-3 py-3 text-mute">{row.mode}</td>
                <td className="px-3 py-3">{row.status}</td>
                {history ? (
                  <>
                    <td className="px-3 py-3 text-mute">{row.progress ?? "—"}</td>
                    <td className="px-3 py-3 text-mute">{row.fitment ?? "—"}</td>
                    <td className="px-3 py-3 text-mute">{row.images ?? "—"}</td>
                    <td className="px-3 py-3 text-mute">{row.duration ?? "—"}</td>
                  </>
                ) : null}
                <td className="px-3 py-3 text-mute">{row.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
