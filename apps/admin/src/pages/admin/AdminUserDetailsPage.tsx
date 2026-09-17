import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AdminCard,
  AdminConfirm,
  AdminPageHeader,
  AdminStatCard,
  AdminTabs,
  EmptyState,
  ErrorState,
  GhostButton,
  LoadingSkeleton,
  ModeBadge,
  PrimaryButton,
  StatusBadge,
} from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { adminGet, adminSend, type AdminJob, type AdminUser } from "../../lib/admin-api";
import { formatAdminDate, formatAdminDateTime, initials } from "../../lib/admin-format";

type Detail = {
  user: AdminUser;
  statistics: { totalJobs: number; fullScrapes: number; fitmentOnly: number; successRate: number | null };
  recentJobs: AdminJob[];
  activity: Array<{ event: string; details: string; createdAt: string }>;
};

export function AdminUserDetailsPage() {
  const { userId = "" } = useParams();
  const toast = useAdminToast();
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"disable" | "enable" | "reset" | null>(null);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");

  function load() {
    void adminGet<Detail>(`/api/v1/admin/users/${userId}`)
      .then((next) => {
        setData(next);
        setName(next.user.name);
        setError("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load user"));
  }

  useEffect(() => {
    load();
  }, [userId]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }
  if (!data) {
    return <LoadingSkeleton rows={8} />;
  }

  const disabled = data.user.status === "disabled";

  return (
    <div>
      <AdminPageHeader title="User Details" subtitle="View activity and manage account access." />
      <AdminCard className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[image:var(--ss-cta)] text-lg font-bold">
            {initials(data.user.name)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{data.user.name}</h2>
              <StatusBadge status={data.user.status} />
            </div>
            <p className="text-sm text-mute">{data.user.email}</p>
            <p className="mt-1 text-xs text-faint">
              Joined {formatAdminDate(data.user.createdAt)} · Last Active {formatAdminDate(data.user.lastActive)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => setEdit(true)}>Edit User</GhostButton>
          <button
            type="button"
            className="min-h-10 rounded-btn border border-danger/40 px-4 text-sm text-danger"
            onClick={() => setConfirm(disabled ? "enable" : "disable")}
          >
            {disabled ? "Enable Account" : "Disable Account"}
          </button>
          <GhostButton onClick={() => setConfirm("reset")}>Reset Password</GhostButton>
        </div>
      </AdminCard>
      <AdminTabs tabs={["Overview", "Job History", "Activity Logs", "Settings"]} value={tab} onChange={setTab} />
      {tab === "Overview" || tab === "Job History" ? (
        <>
          {tab === "Overview" ? (
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <AdminStatCard label="Total Jobs" value={data.statistics.totalJobs} />
              <AdminStatCard label="Full Scrapes" value={data.statistics.fullScrapes} />
              <AdminStatCard label="Fitment Only" value={data.statistics.fitmentOnly} />
              <AdminStatCard
                label="Success Rate"
                value={data.statistics.successRate == null ? "—" : `${data.statistics.successRate}%`}
                tone="ok"
              />
            </div>
          ) : null}
          <AdminCard>
            <h3 className="mb-3 font-bold">Recent Jobs</h3>
            {data.recentJobs.length === 0 ? <EmptyState message="No jobs found." /> : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">Source Item</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentJobs.map((job) => (
                    <tr key={job.jobId} className="border-t border-line">
                      <td className="px-3 py-3">
                        <Link to={`/admin/jobs/${job.jobId}`}>{job.jobId.slice(0, 8)}</Link>
                      </td>
                      <td className="px-3 py-3">{job.sourceItemId || "—"}</td>
                      <td className="px-3 py-3">
                        <ModeBadge mode={job.mode} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-3 py-3 text-mute">{job.duration}</td>
                      <td className="px-3 py-3 text-mute">{formatAdminDate(job.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AdminCard>
        </>
      ) : null}
      {tab === "Activity Logs" ? (
        <AdminCard>
          {data.activity.length === 0 ? <EmptyState message="No audit events." /> : (
            <ul className="space-y-3 text-sm">
              {data.activity.map((event) => (
                <li key={`${event.event}-${event.createdAt}`} className="border-b border-line pb-2">
                  <p className="font-medium">{event.event}</p>
                  <p className="text-mute">{event.details}</p>
                  <p className="text-xs text-faint">{formatAdminDateTime(event.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      ) : null}
      {tab === "Settings" ? (
        <AdminCard>
          <p className="text-sm text-mute">Role: {data.user.role}</p>
          <p className="mt-2 text-sm text-mute">Use Edit User to change the display name.</p>
        </AdminCard>
      ) : null}
      <AdminConfirm
        open={confirm === "disable" || confirm === "enable"}
        title={disabled ? "Enable this user?" : "Disable this user?"}
        message={disabled ? "They will be able to sign in again." : "They will be blocked from protected API operations."}
        confirmLabel={disabled ? "Enable" : "Disable"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void adminSend(`/api/v1/admin/users/${userId}/status`, "PATCH", {
            status: disabled ? "active" : "disabled",
          })
            .then(() => {
              toast(disabled ? "User enabled" : "User disabled");
              setConfirm(null);
              load();
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Update failed", "err"));
        }}
      />
      <AdminConfirm
        open={confirm === "reset"}
        title="Reset password?"
        message="A password reset will be requested for this email. The current password is never shown."
        confirmLabel="Send reset"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void adminSend(`/api/v1/admin/users/${userId}/password-reset`, "POST", {})
            .then(() => {
              toast("Password reset initiated");
              setConfirm(null);
            })
            .catch((err: unknown) => toast(err instanceof Error ? err.message : "Reset failed", "err"));
        }}
      />
      {edit ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-4">
          <form
            className="w-full max-w-md space-y-3 rounded-[14px] border border-line bg-admin-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void adminSend(`/api/v1/admin/users/${userId}`, "PATCH", { name })
                .then(() => {
                  toast("User updated");
                  setEdit(false);
                  load();
                })
                .catch((err: unknown) => toast(err instanceof Error ? err.message : "Update failed", "err"));
            }}
          >
            <h2 className="text-lg font-bold">Edit User</h2>
            <input value={name} onChange={(event) => setName(event.target.value)} className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm" />
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setEdit(false)}>Cancel</GhostButton>
              <PrimaryButton type="submit">Save</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
