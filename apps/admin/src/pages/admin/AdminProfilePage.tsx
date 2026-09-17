import { type FormEvent, useEffect, useState } from "react";
import { AdminCard, AdminPageHeader, AdminTabs, ErrorState, GhostButton, LoadingSkeleton, PrimaryButton } from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { authClient } from "../../lib/auth-client";
import { adminGet, adminSend } from "../../lib/admin-api";
import { formatAdminDateTime, initials } from "../../lib/admin-format";

type Profile = {
  user: { id: string; name: string; email: string; role: string; lastLogin: string | null };
  sessions: Array<{ id: string; updatedAt: string; ipAddress: string | null; userAgent: string | null }>;
  activity: Array<{ event: string; details: string; createdAt: string }>;
};

export function AdminProfilePage() {
  const toast = useAdminToast();
  const [tab, setTab] = useState("Profile");
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [pageSize, setPageSize] = useState(localStorage.getItem("admin.pageSize") || "25");
  const [range, setRange] = useState(localStorage.getItem("admin.range") || "7d");

  useEffect(() => {
    void adminGet<Profile>("/api/v1/admin/profile")
      .then((next) => {
        setData(next);
        setName(next.user.name);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load profile"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingSkeleton />;

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error: authError } = await authClient.changePassword({
      currentPassword: String(form.get("current") ?? ""),
      newPassword: String(form.get("next") ?? ""),
    });
    toast(authError?.message || "Password updated", authError ? "err" : "ok");
  }

  return (
    <div>
      <AdminPageHeader title="Admin Profile" subtitle="Manage your admin account." />
      <AdminTabs tabs={["Profile", "Security", "Activity", "Preferences"]} value={tab} onChange={setTab} />
      {tab === "Profile" ? (
        <AdminCard className="max-w-xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[image:var(--ss-cta)] text-xl font-bold">{initials(data.user.name)}</span>
            <div>
              <p className="font-bold">{data.user.name}</p>
              <p className="text-sm text-mute">{data.user.email}</p>
            </div>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void adminSend("/api/v1/admin/profile", "PATCH", { name }).then(() => toast("Profile updated"));
            }}
          >
            <label className="block text-sm">Name
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
            </label>
            <p className="text-sm text-mute">Role: Super Admin</p>
            <p className="text-sm text-mute">Last login: {formatAdminDateTime(data.user.lastLogin)}</p>
            <PrimaryButton type="submit">Update Profile</PrimaryButton>
          </form>
        </AdminCard>
      ) : null}
      {tab === "Security" ? (
        <AdminCard className="max-w-xl">
          <form className="space-y-3" onSubmit={(event) => void onPassword(event)}>
            <input name="current" type="password" required placeholder="Current password" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
            <input name="next" type="password" minLength={8} required placeholder="New password" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3" />
            <PrimaryButton type="submit">Change Password</PrimaryButton>
          </form>
          <h3 className="mt-6 font-bold">Sessions</h3>
          <ul className="mt-2 space-y-2 text-sm text-mute">
            {data.sessions.map((session) => (
              <li key={session.id}>Updated {formatAdminDateTime(session.updatedAt)} · {session.ipAddress ?? "IP hidden"}</li>
            ))}
          </ul>
        </AdminCard>
      ) : null}
      {tab === "Activity" ? (
        <AdminCard>
          {data.activity.length === 0 ? <p className="text-sm text-mute">No admin audit events yet.</p> : data.activity.map((event) => (
            <div key={`${event.event}-${event.createdAt}`} className="border-b border-line py-2 text-sm">
              <p className="font-medium">{event.event}</p>
              <p className="text-mute">{event.details}</p>
              <p className="text-xs text-faint">{formatAdminDateTime(event.createdAt)}</p>
            </div>
          ))}
        </AdminCard>
      ) : null}
      {tab === "Preferences" ? (
        <AdminCard className="max-w-xl space-y-3">
          <label className="block text-sm">Default date range
            <select value={range} onChange={(event) => setRange(event.target.value)} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>
          <label className="block text-sm">Table page size
            <select value={pageSize} onChange={(event) => setPageSize(event.target.value)} className="mt-1 min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <GhostButton
            onClick={() => {
              localStorage.setItem("admin.pageSize", pageSize);
              localStorage.setItem("admin.range", range);
              toast("Preferences saved");
            }}
          >
            Save preferences
          </GhostButton>
        </AdminCard>
      ) : null}
    </div>
  );
}
