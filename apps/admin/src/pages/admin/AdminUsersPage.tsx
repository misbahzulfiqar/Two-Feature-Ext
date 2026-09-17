import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AdminCard,
  AdminPageHeader,
  AdminStatCard,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingSkeleton,
  Pagination,
  PrimaryButton,
  SearchInput,
  StatusBadge,
} from "../../components/admin/common/AdminUi";
import { useAdminToast } from "../../components/admin/common/AdminToast";
import { adminGet, adminSend, type AdminUser, type Paged } from "../../lib/admin-api";
import { formatAdminDate } from "../../lib/admin-format";

type UsersResponse = Paged<AdminUser> & {
  stats: { total: number; active: number; disabled: number; newThisMonth: number };
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("latest");
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      sort,
    });
    if (debounced) {
      params.set("search", debounced);
    }
    if (status !== "all") {
      params.set("status", status);
    }
    void adminGet<UsersResponse>(`/api/v1/admin/users?${params}`)
      .then((next) => {
        setData(next);
        setError("");
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load users");
        setLoading(false);
      });
  }, [page, debounced, status, sort]);

  return (
    <div>
      <AdminPageHeader
        title="Users"
        subtitle="Manage user accounts, view activity and control access."
        actions={<PrimaryButton onClick={() => setAddOpen(true)}>+ Add User</PrimaryButton>}
      />
      {data ? (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <AdminStatCard label="Total Users" value={data.stats.total} />
          <AdminStatCard label="Active Users" value={data.stats.active} tone="ok" />
          <AdminStatCard label="Inactive / Disabled" value={data.stats.disabled} tone="danger" />
          <AdminStatCard label="New This Month" value={data.stats.newThisMonth} tone="info" />
        </div>
      ) : null}
      <AdminCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" />
          <FilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "disabled", label: "Disabled" },
            ]}
          />
          <FilterSelect
            value={sort}
            onChange={setSort}
            options={[
              { value: "latest", label: "Latest" },
              { value: "oldest", label: "Oldest" },
              { value: "jobs", label: "Most Jobs" },
              { value: "recent", label: "Recently Active" },
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
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Jobs</th>
                    <th className="px-3 py-2 font-medium">Last Active</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState message="No users found." />
                      </td>
                    </tr>
                  ) : (
                    data.items.map((user) => (
                      <tr
                        key={user.id}
                        className="cursor-pointer border-t border-line hover:bg-white/5"
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                      >
                        <td className="px-3 py-3 font-medium">{user.name}</td>
                        <td className="px-3 py-3 text-mute">{user.email}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-3 py-3">{user.jobs}</td>
                        <td className="px-3 py-3 text-mute">{formatAdminDate(user.lastActive)}</td>
                        <td className="px-3 py-3 text-mute">{formatAdminDate(user.createdAt)}</td>
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
      {addOpen ? (
        <AddUserModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            toast("User created");
            setPage(1);
            setSearch(search);
          }}
        />
      ) : null}
    </div>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useAdminToast();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await adminSend("/api/v1/admin/users", "POST", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        role: String(form.get("role") ?? "user"),
      });
      onCreated();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create user", "err");
    }
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-4">
      <form className="w-full max-w-md space-y-3 rounded-[14px] border border-line bg-admin-card p-6" onSubmit={(event) => void onSubmit(event)}>
        <h2 className="text-lg font-bold">Add User</h2>
        <input name="name" required placeholder="Name" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm" />
        <input name="email" type="email" required placeholder="Email" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm" />
        <input name="password" type="password" minLength={8} required placeholder="Temporary password" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm" />
        <select name="role" className="min-h-10 w-full rounded-field border border-line bg-admin-card-2 px-3 text-sm">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-10 rounded-btn border border-line px-4 text-sm" onClick={onClose}>
            Cancel
          </button>
          <PrimaryButton type="submit">Create</PrimaryButton>
        </div>
      </form>
    </div>
  );
}
