import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminCard, AdminConfirm, AdminPageHeader, AdminStatCard, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton } from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { adminGet, adminSend } from "../../lib/admin-api";

type Extensions = {
  currentExtension: string;
  minimumSupported: string;
  apiVersion: string;
  scraperVersion: string;
  selectorProfile: string | null;
  distribution: Array<{ version: string; users: number; percent: number }>;
  outdatedUsers: number;
};

export function AdminExtensionsPage() {
  const toast = useAdminToast();
  const [data, setData] = useState<Extensions | null>(null);
  const [error, setError] = useState("");
  const [minimum, setMinimum] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void adminGet<Extensions>("/api/v1/admin/extensions")
      .then((next) => {
        setData(next);
        setMinimum(next.minimumSupported);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load versions"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingSkeleton />;

  return (
    <div>
      <AdminPageHeader title="Extension Versions" subtitle="Track extension, API and scraper versions." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <AdminStatCard label="Current Extension" value={data.currentExtension} />
        <AdminStatCard label="Minimum Supported" value={data.minimumSupported} />
        <AdminStatCard label="API Version" value={data.apiVersion} />
        <AdminStatCard label="Scraper Version" value={data.scraperVersion} />
        <AdminStatCard label="Selector Profile" value={data.selectorProfile ?? "—"} />
      </div>
      <AdminCard>
        <h2 className="mb-4 font-bold">Users by Extension Version</h2>
        {data.distribution.length === 0 ? (
          <EmptyState message="No extension version reports yet. Versions are recorded when jobs include them." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.distribution} layout="vertical">
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="version" tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0d1424", border: "1px solid rgba(255,255,255,0.08)" }} />
                <Bar dataKey="users" fill="#8b5cf6" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-3 text-sm text-mute">Users on outdated versions: {data.outdatedUsers}</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">Minimum supported
            <input value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-1 min-h-10 rounded-field border border-line bg-admin-card-2 px-3" />
          </label>
          <PrimaryButton onClick={() => setConfirm(true)}>Update minimum</PrimaryButton>
        </div>
      </AdminCard>
      <AdminConfirm
        open={confirm}
        title="Change minimum supported version?"
        message={`Clients below ${minimum} may be treated as outdated.`}
        confirmLabel="Update"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          void adminSend("/api/v1/admin/extensions/minimum-supported", "PATCH", { minimumSupported: minimum })
            .then(() => {
              toast("Minimum supported version updated");
              setConfirm(false);
              setData({ ...data, minimumSupported: minimum });
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Update failed", "err"));
        }}
      />
    </div>
  );
}
