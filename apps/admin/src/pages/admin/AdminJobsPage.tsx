import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingSkeleton,
  ModeBadge,
  Pagination,
  SearchInput,
  StatusBadge,
} from "../../components/admin/common/AdminUi";
import { adminGet, type AdminJob, type Paged } from "../../lib/admin-api";
import { formatAdminDateTime } from "../../lib/admin-format";

export function AdminJobsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<Paged<AdminJob> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (debounced) params.set("search", debounced);
    if (mode !== "all") params.set("mode", mode);
    if (status !== "all") params.set("status", status);
    void adminGet<Paged<AdminJob>>(`/api/v1/admin/jobs?${params}`)
      .then((next) => {
        setData(next);
        setError("");
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load jobs");
        setLoading(false);
      });
  }, [page, debounced, mode, status]);

  return (
    <div>
      <AdminPageHeader title="Scrape Jobs" subtitle="View and manage all scraping jobs across users." />
      <AdminCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Job ID, user email, or item ID" />
          <FilterSelect
            value={mode}
            onChange={(value) => {
              setMode(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All modes" },
              { value: "full-scrape", label: "Full Scrape" },
              { value: "only-fitment", label: "Fitment Only" },
            ]}
          />
          <FilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All status" },
              { value: "queued", label: "Queued" },
              { value: "processing", label: "Processing" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </div>
        {error ? <ErrorState message={error} /> : null}
        {loading ? <LoadingSkeleton /> : null}
        {!loading && data ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Source Item ID</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message="No jobs found." />
                      </td>
                    </tr>
                  ) : (
                    data.items.map((job) => (
                      <tr
                        key={job.jobId}
                        className="cursor-pointer border-t border-line hover:bg-white/5"
                        onClick={() => navigate(`/admin/jobs/${job.jobId}`)}
                      >
                        <td className="px-3 py-3 font-medium">{job.jobId.slice(0, 8)}</td>
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
            <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
          </>
        ) : null}
      </AdminCard>
    </div>
  );
}
