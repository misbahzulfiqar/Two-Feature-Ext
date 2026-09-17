import { useEffect, useState } from "react";
import { AdminCard, AdminPageHeader, EmptyState, ErrorState, FilterSelect, LoadingSkeleton, Pagination, SearchInput } from "../../components/admin/common/AdminUi";
import { adminGet, type Paged } from "../../lib/admin-api";
import { formatAdminDateTime } from "../../lib/admin-format";

type AuditItem = { event: string; user: string; details: string; createdAt: string };

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [event, setEvent] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<Paged<AuditItem> | null>(null);
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
    if (event) params.set("event", event);
    void adminGet<Paged<AuditItem>>(`/api/v1/admin/audit?${params}`)
      .then((next) => {
        setData(next);
        setError("");
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load audit logs");
        setLoading(false);
      });
  }, [page, debounced, event]);

  return (
    <div>
      <AdminPageHeader title="Audit Logs" subtitle="Track system events, user actions and job progress." />
      <AdminCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search details or user" />
          <FilterSelect
            value={event}
            onChange={setEvent}
            options={[
              { value: "", label: "All events" },
              { value: "admin.user_disabled", label: "user.disabled" },
              { value: "admin.user_enabled", label: "user.enabled" },
              { value: "admin.settings_changed", label: "admin.setting_changed" },
              { value: "admin.job_retried", label: "job retried" },
            ]}
          />
        </div>
        {error ? <ErrorState message={error} /> : null}
        {loading ? <LoadingSkeleton /> : null}
        {!loading && data ? (
          <>
            <table className="min-w-full text-left text-sm">
              <thead className="text-faint">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={4}><EmptyState message="No audit events." /></td>
                  </tr>
                ) : data.items.map((item) => (
                  <tr key={`${item.event}-${item.createdAt}`} className="border-t border-line">
                    <td className="px-3 py-3 text-mute">{formatAdminDateTime(item.createdAt)}</td>
                    <td className="px-3 py-3 font-medium">{item.event}</td>
                    <td className="px-3 py-3">{item.user}</td>
                    <td className="px-3 py-3 text-mute">{item.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
          </>
        ) : null}
      </AdminCard>
    </div>
  );
}
