import { useEffect, useState } from "react";
import { AdminCard, AdminPageHeader, AdminStatCard, EmptyState, ErrorState, LoadingSkeleton } from "../../components/admin/common/AdminUi";
import { adminGet } from "../../lib/admin-api";
import { formatAdminDateTime } from "../../lib/admin-format";

type Summary = {
  total: number;
  uniqueTypes: number;
  critical: number;
  thisWeek: number;
  types: Array<{ code: string; description: string; severity: string; count: number; lastOccurrence: string }>;
};

type Detail = {
  code: string;
  description: string;
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
  affectedUsers: number;
  affectedJobs: number;
  occurrences: Array<{ timestamp: string; jobId: string; user: string | null; message: string; stage: string }>;
};

export function AdminErrorsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Detail | null>(null);

  function load() {
    void adminGet<Summary>("/api/v1/admin/errors/summary")
      .then((next) => {
        setSummary(next);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load errors"));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <AdminPageHeader title="Error Center" subtitle="View and analyze errors across the system." />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!summary && !error ? <LoadingSkeleton /> : null}
      {summary ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <AdminStatCard label="Total Errors" value={summary.total} />
            <AdminStatCard label="Unique Types" value={summary.uniqueTypes} />
            <AdminStatCard label="Critical" value={summary.critical} tone="danger" />
            <AdminStatCard label="This Week" value={summary.thisWeek} tone="warn" />
          </div>
          <AdminCard>
            <h2 className="mb-3 font-bold">Error Types</h2>
            {summary.types.length === 0 ? <EmptyState message="No errors recorded." /> : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="px-3 py-2">Error Code</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Count</th>
                    <th className="px-3 py-2">Last Occurrence</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.types.map((row) => (
                    <tr
                      key={row.code}
                      className="cursor-pointer border-t border-line hover:bg-white/5"
                      onClick={() => {
                        void adminGet<Detail>(`/api/v1/admin/errors/${row.code}`).then(setSelected);
                      }}
                    >
                      <td className="px-3 py-3 font-medium">{row.code}</td>
                      <td className="px-3 py-3 text-mute">{row.description}</td>
                      <td className="px-3 py-3">{row.count}</td>
                      <td className="px-3 py-3 text-mute">{formatAdminDateTime(row.lastOccurrence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AdminCard>
        </>
      ) : null}
      {selected ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/50">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-admin-card p-6">
            <button type="button" className="text-sm text-mute" onClick={() => setSelected(null)}>Close</button>
            <h2 className="mt-3 text-xl font-bold">{selected.code}</h2>
            <p className="text-sm text-mute">{selected.description}</p>
            <p className="mt-2 text-sm">Count {selected.count} · Users {selected.affectedUsers} · Jobs {selected.affectedJobs}</p>
            <p className="text-xs text-faint">First {formatAdminDateTime(selected.firstOccurrence)} · Last {formatAdminDateTime(selected.lastOccurrence)}</p>
            <h3 className="mt-5 font-bold">Recent occurrences</h3>
            {selected.occurrences.map((row) => (
              <div key={`${row.jobId}-${row.timestamp}`} className="border-b border-line py-2 text-sm">
                <p>{row.jobId.slice(0, 8)} · {row.user ?? "—"}</p>
                <p className="text-mute">{row.message}</p>
                <p className="text-xs text-faint">{row.stage} · {formatAdminDateTime(row.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
