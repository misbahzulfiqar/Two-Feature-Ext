import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdminCard, AdminPageHeader, AdminStatCard, DateRangePicker, EmptyState, ErrorState, LoadingSkeleton, ModeBadge, StatusBadge } from "../../components/admin/common/AdminUi";
import { useAdminPolling } from "../../hooks/use-admin-polling";
import { adminGet, type AdminJob } from "../../lib/admin-api";
import { formatAdminDateTime } from "../../lib/admin-format";
import { useSessionUser } from "../../lib/session";

type DashboardData = {
  users: { total: number; active: number };
  jobs: { today: number; total: number; completed: number; failed: number; queued: number; processing: number };
  activity: Array<{ date: string; completed: number; failed: number; queued: number }>;
  recentJobs: AdminJob[];
};

const PIE = ["#8b5cf6", "#ef4444", "#f59e0b"];

export function AdminDashboardPage() {
  const { name } = useSessionUser();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setError("");
    void adminGet<DashboardData>(`/api/v1/admin/dashboard?range=${range}`)
      .then((next) => {
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
        setLoading(false);
      });
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useAdminPolling(load, 45_000, !loading && !error);

  const pieData = [
    { name: "Completed", value: data?.jobs.completed ?? 0 },
    { name: "Failed", value: data?.jobs.failed ?? 0 },
    { name: "Queued", value: (data?.jobs.queued ?? 0) + (data?.jobs.processing ?? 0) },
  ];
  const pieTotal = pieData.reduce((sum, row) => sum + row.value, 0);

  return (
    <div>
      <AdminPageHeader
        title={`Welcome back, ${name.split(" ")[0] || "Admin"}! 👋`}
        subtitle="Everything looks good. Here's what's happening with eBay Sell Similar."
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading && !data ? <LoadingSkeleton rows={8} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <AdminStatCard label="Total Users" value={data.users.total} />
            <AdminStatCard label="Jobs Today" value={data.jobs.today} tone="info" />
            <AdminStatCard label="Completed" value={data.jobs.completed} tone="ok" />
            <AdminStatCard label="Failed" value={data.jobs.failed} tone="danger" />
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
            <AdminCard>
              <h2 className="mb-4 font-bold">Jobs Activity</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.activity}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0d1424", border: "1px solid rgba(255,255,255,0.08)" }} />
                    <Area type="monotone" dataKey="completed" stroke="#8b5cf6" fill="#8b5cf633" />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#ef444422" />
                    <Area type="monotone" dataKey="queued" stroke="#f59e0b" fill="#f59e0b22" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>
            <AdminCard className="flex flex-col items-center">
              <h2 className="mb-2 self-start font-bold">Job Status</h2>
              <div className="relative h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={62} outerRadius={86} paddingAngle={3}>
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE[index] ?? "#64748b"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-2xl font-extrabold">{pieTotal}</p>
                    <p className="text-xs text-mute">Total</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-mute">
                <span>Completed {data.jobs.completed}</span>
                <span>Failed {data.jobs.failed}</span>
                <span>Queued {data.jobs.queued}</span>
              </div>
            </AdminCard>
          </div>
          <AdminCard className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Recent Jobs</h2>
              <Link to="/admin/jobs" className="text-sm text-mute">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">Job ID</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Source Item ID</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message="No jobs found." />
                      </td>
                    </tr>
                  ) : (
                    data.recentJobs.map((job) => (
                      <tr key={job.jobId} className="border-t border-line">
                        <td className="px-3 py-3">
                          <Link to={`/admin/jobs/${job.jobId}`} className="font-medium hover:text-violet-bright">
                            {job.jobId.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-mute">{job.user?.email ?? "—"}</td>
                        <td className="px-3 py-3">{job.sourceItemId || "—"}</td>
                        <td className="px-3 py-3">
                          <ModeBadge mode={job.mode} />
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-3 py-3 text-mute">{job.duration}</td>
                        <td className="px-3 py-3 text-mute">{formatAdminDateTime(job.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </>
      ) : null}
    </div>
  );
}
