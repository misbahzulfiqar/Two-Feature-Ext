import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/admin", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/jobs", label: "Scrape Jobs", icon: JobsIcon },
  { to: "/admin/audit", label: "Audit Logs", icon: AuditIcon },
  { to: "/admin/errors", label: "Errors", icon: ErrorIcon },
  { to: "/admin/workers", label: "Workers & Queue", icon: WorkersIcon },
  { to: "/admin/health", label: "System Health", icon: HealthIcon },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { to: "/admin/extensions", label: "Extension Versions", icon: PuzzleIcon },
] as const;

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-[248px] flex-col border-r border-line bg-admin-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/logo.png?v=4" alt="" className="h-9 w-9 object-contain" />
        <div>
          <p className="text-sm font-extrabold leading-tight">eBay Sell Similar</p>
          <span className="mt-1 inline-flex rounded-full bg-violet/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-bright">
            Admin
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={"end" in link ? link.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium ${
                isActive ? "bg-[image:var(--ss-cta)] text-white shadow-cta" : "text-mute hover:bg-white/5 hover:text-ink"
              }`
            }
          >
            <link.icon />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4 text-xs text-faint">
        <p>Version 1.0.0</p>
      </div>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13h8V4H4v9Zm10 7h6V4h-6v16ZM4 20h8v-5H4v5Z" fill="currentColor" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 12Zm8 2c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4ZM8 16c-.7 0-1.4.1-2 .3C4.2 16.8 3 18 3 20v2h5v-2c0-1.5.4-2.7 1.1-3.6A9.6 9.6 0 0 0 8 16Z" fill="currentColor" />
    </svg>
  );
}
function JobsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4V6Zm2 2v8h12V8H6Zm3 2h6v2H9V10Z" fill="currentColor" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h10v18H7V3Zm2 2v14h6V5H9Zm1 2h4v2h-4V7Zm0 4h4v2h-4v-2Z" fill="currentColor" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 2 21h20L12 3Zm0 5 6.5 11h-13L12 8Zm-1 3h2v4h-2v-4Zm0 5h2v2h-2v-2Z" fill="currentColor" />
    </svg>
  );
}
function WorkersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h6v6H4V7Zm10 0h6v6h-6V7ZM4 15h6v6H4v-6Zm10 2h6v4h-6v-4Z" fill="currentColor" />
    </svg>
  );
}
function HealthIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h4l2-5 4 10 2-5h6" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 3h4l.5 3.2a7 7 0 0 1 1.8.8L19 5.5 21.5 8l-1.5 2.6c.3.6.5 1.2.6 1.9L24 13v4l-3.4.5a7 7 0 0 1-.8 1.8L21.5 22 19 24.5l-2.6-1.5a7 7 0 0 1-1.9.6L13 27h-4l-.5-3.4a7 7 0 0 1-1.8-.8L3.5 24.5 1 22l1.5-2.6a7 7 0 0 1-.6-1.9L-2 17v-4l3.4-.5c.2-.7.5-1.3.8-1.8L1 8l2.5-2.5 2.6 1.5c.6-.3 1.2-.5 1.9-.6L10 3Z" transform="scale(.7) translate(6 0)" fill="currentColor" />
    </svg>
  );
}
function PuzzleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 3a2 2 0 1 1 4 0 3 3 0 0 1 3 3h3v4a2 2 0 1 0 0 4v4h-4a2 2 0 1 0-4 0H7v-4a3 3 0 0 1-3-3 2 2 0 1 1 0-4 3 3 0 0 1 3-3h2V3Z" fill="currentColor" />
    </svg>
  );
}
