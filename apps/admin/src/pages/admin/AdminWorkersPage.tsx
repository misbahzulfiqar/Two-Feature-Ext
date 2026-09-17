import { useCallback, useEffect, useState } from "react";
import { AdminCard, AdminPageHeader, AdminStatCard, EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from "../../components/admin/common/AdminUi";
import { useAdminPolling } from "../../hooks/use-admin-polling";
import { adminGet } from "../../lib/admin-api";
import { modeLabel } from "../../lib/admin-format";

type WorkersData = {
  configuredConcurrency: number;
  workers: Array<{ id: string; name: string; status: string; currentJob: string | null; runtimeMs: number | null; lastHeartbeat: string | null; version: string }>;
  queue: {
    waiting: number;
    active: number;
    failed: number;
    longestWaitMs: number | null;
    averageProcessingMs: number | null;
    oldestActiveMs: number | null;
    jobs: Array<{ position: number; jobId: string; user: string | null; mode: string; waitingMs: number }>;
  };
  stats: { activeWorkers: number; queuedJobs: number; processing: number; failedJobs: number };
};

function ms(value: number | null): string {
  if (value == null) return "—";
  if (value < 1000) return `${value}ms`;
  return `${Math.round(value / 1000)}s`;
}

export function AdminWorkersPage() {
  const [data, setData] = useState<WorkersData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    void adminGet<WorkersData>("/api/v1/admin/workers")
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load workers"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useAdminPolling(load, 5000, Boolean(data) || Boolean(error));

  return (
    <div>
      <AdminPageHeader title="Workers & Queue" subtitle="Monitor scraper workers and job queue status." />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <LoadingSkeleton /> : null}
      {data ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <AdminStatCard label="Active Workers" value={`${data.stats.activeWorkers}/${data.configuredConcurrency}`} tone="ok" />
            <AdminStatCard label="Queued Jobs" value={data.stats.queuedJobs} tone="warn" />
            <AdminStatCard label="Processing" value={data.stats.processing} tone="info" />
            <AdminStatCard label="Failed Jobs" value={data.stats.failedJobs} tone="danger" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <AdminCard>
              <h2 className="mb-3 font-bold">Worker Status</h2>
              <div className="space-y-2">
                {data.workers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between rounded-[12px] border border-line bg-admin-card-2 px-4 py-3">
                    <div>
                      <p className="font-semibold">{worker.name}</p>
                      <p className="text-xs text-mute">v{worker.version} · {worker.currentJob ?? "No current job"}</p>
                    </div>
                    <StatusBadge status={worker.status} />
                  </div>
                ))}
              </div>
            </AdminCard>
            <AdminCard>
              <h2 className="mb-3 font-bold">Queue Status</h2>
              <p className="text-sm text-mute">Longest queued: {ms(data.queue.longestWaitMs)}</p>
              <p className="text-sm text-mute">Average processing: {ms(data.queue.averageProcessingMs)}</p>
              <p className="text-sm text-mute">Oldest active: {ms(data.queue.oldestActiveMs)}</p>
            </AdminCard>
          </div>
          <AdminCard className="mt-4">
            <h2 className="mb-3 font-bold">Queued Jobs</h2>
            {data.queue.jobs.length === 0 ? <EmptyState message="No queued jobs." /> : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Waiting Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queue.jobs.map((job) => (
                    <tr key={job.jobId} className="border-t border-line">
                      <td className="px-3 py-3">{job.position}</td>
                      <td className="px-3 py-3">{job.jobId.slice(0, 8)}</td>
                      <td className="px-3 py-3">{job.user ?? "—"}</td>
                      <td className="px-3 py-3">{modeLabel(job.mode)}</td>
                      <td className="px-3 py-3">{ms(job.waitingMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AdminCard>
        </>
      ) : null}
    </div>
  );
}
