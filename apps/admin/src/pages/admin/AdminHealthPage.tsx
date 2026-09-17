import { useCallback, useEffect, useState } from "react";
import { AdminCard, AdminPageHeader, ErrorState, LoadingSkeleton, StatusBadge } from "../../components/admin/common/AdminUi";
import { useAdminPolling } from "../../hooks/use-admin-polling";
import { adminGet } from "../../lib/admin-api";

type Check = { status: string; latencyMs: number | null; detail?: string; uptimeSeconds?: number; version?: string };
type Health = { checks: Record<string, Check>; checkedAt: string };

const CARDS: Array<{ key: string; title: string }> = [
  { key: "api", title: "API Server" },
  { key: "mongo", title: "MongoDB" },
  { key: "redis", title: "Redis" },
  { key: "scraperWorkers", title: "Scraper Workers" },
  { key: "agenda", title: "Agenda / Cron" },
  { key: "extensionApi", title: "Chrome Extension API" },
  { key: "storage", title: "Storage" },
];

export function AdminHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    void adminGet<Health>("/api/v1/admin/health")
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load health"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useAdminPolling(load, 12_000, Boolean(data) || Boolean(error));

  return (
    <div>
      <AdminPageHeader title="System Health" subtitle="Monitor the health and status of all system components." />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!data && !error ? <LoadingSkeleton /> : null}
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((card) => {
            const check = data.checks[card.key];
            return (
              <AdminCard key={card.key}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">{card.title}</h2>
                  <StatusBadge status={check?.status ?? "offline"} />
                </div>
                <p className="mt-3 text-sm text-mute">{check?.detail ?? "—"}</p>
                <p className="mt-1 text-xs text-faint">
                  {check?.latencyMs != null ? `${check.latencyMs}ms` : "—"}
                  {check?.version ? ` · v${check.version}` : ""}
                  {check?.uptimeSeconds != null ? ` · up ${Math.floor(check.uptimeSeconds / 3600)}h` : ""}
                </p>
              </AdminCard>
            );
          })}
          <AdminCard>
            <h2 className="font-bold">Uptime</h2>
            <p className="mt-3 text-2xl font-extrabold">{data.checks.api?.uptimeSeconds != null ? `${Math.floor((data.checks.api.uptimeSeconds) / 3600)}h` : "—"}</p>
            <p className="text-xs text-faint">Last check {new Date(data.checkedAt).toLocaleTimeString()}</p>
          </AdminCard>
        </div>
      ) : null}
    </div>
  );
}
