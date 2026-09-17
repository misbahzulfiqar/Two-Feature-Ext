import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../../../lib/auth-client";
import { adminGet } from "../../../lib/admin-api";
import { initials } from "../../../lib/admin-format";
import { useSessionUser } from "../../../lib/session";

type SearchResult = {
  users: Array<{ id: string; name: string; email: string }>;
  jobs: Array<{ jobId: string; sourceItemId: string; status: string }>;
};

type Notice = { id: string; title: string; detail: string; createdAt: string; tone: string };

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const { name, email } = useSessionUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [openNotices, setOpenNotices] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setResults(null);
        return;
      }
      void adminGet<SearchResult>(`/api/v1/admin/search?q=${encodeURIComponent(query.trim())}`).then(setResults);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    void adminGet<{ items: Notice[] }>("/api/v1/admin/notifications")
      .then((data) => setNotices(data.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setResults(null);
        setOpenNotices(false);
        setOpenUser(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header ref={box} className="flex h-16 items-center gap-3 border-b border-line bg-[#080d18] px-4">
      <button type="button" className="min-h-10 min-w-10 rounded-btn border border-line lg:hidden" aria-label="Open menu" onClick={onMenu}>
        ☰
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anything..."
          className="h-10 w-full max-w-xl rounded-full border border-line bg-admin-card px-4 text-sm outline-none placeholder:text-faint"
        />
        {results ? (
          <div className="absolute z-30 mt-2 w-full max-w-xl rounded-[12px] border border-line bg-admin-card p-3 shadow-cta">
            <p className="text-xs font-semibold uppercase text-faint">Users</p>
            {results.users.length === 0 ? <p className="py-2 text-sm text-mute">No users found.</p> : null}
            {results.users.map((user) => (
              <button
                key={user.id}
                type="button"
                className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  navigate(`/admin/users/${user.id}`);
                }}
              >
                {user.name} <span className="text-mute">{user.email}</span>
              </button>
            ))}
            <p className="mt-2 text-xs font-semibold uppercase text-faint">Jobs</p>
            {results.jobs.length === 0 ? <p className="py-2 text-sm text-mute">No jobs found.</p> : null}
            {results.jobs.map((job) => (
              <button
                key={job.jobId}
                type="button"
                className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  navigate(`/admin/jobs/${job.jobId}`);
                }}
              >
                {job.jobId.slice(0, 8)} · {job.sourceItemId} · {job.status}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full border border-line"
          onClick={() => setOpenNotices((value) => !value)}
        >
          <span aria-hidden="true">🔔</span>
          {notices.length > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" /> : null}
        </button>
        {openNotices ? (
          <div className="absolute right-0 z-30 mt-2 w-80 rounded-[12px] border border-line bg-admin-card p-3">
            {notices.length === 0 ? <p className="text-sm text-mute">No critical alerts.</p> : null}
            {notices.map((notice) => (
              <div key={notice.id} className="border-b border-line py-2 last:border-0">
                <p className="text-sm font-semibold">{notice.title}</p>
                <p className="text-xs text-mute">{notice.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button type="button" className="flex items-center gap-2" onClick={() => setOpenUser((value) => !value)}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--ss-cta)] text-xs font-bold">
            {initials(name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold">{name}</span>
            <span className="block text-xs text-mute">Super Admin</span>
          </span>
        </button>
        {openUser ? (
          <div className="absolute right-0 z-30 mt-2 w-48 rounded-[12px] border border-line bg-admin-card p-2 text-sm">
            <Link className="block rounded-lg px-3 py-2 hover:bg-white/5" to="/admin/profile">
              Profile
            </Link>
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
              onClick={() => {
                void authClient.signOut().then(() => navigate("/admin/login"));
              }}
            >
              Logout
            </button>
            <p className="px-3 pt-1 text-[11px] text-faint">{email}</p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
