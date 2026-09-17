import type { ReactNode } from "react";
import { modeLabel } from "../../../lib/admin-format";

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-mute">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "ok" | "danger" | "warn" | "info";
}) {
  const color =
    tone === "ok"
      ? "text-ok"
      : tone === "danger"
        ? "text-danger"
        : tone === "warn"
          ? "text-warn"
          : tone === "info"
            ? "text-admin-info"
            : "text-ink";
  return (
    <div className="rounded-[14px] border border-line bg-admin-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const map: Record<string, string> = {
    completed: "bg-ok/15 text-ok",
    active: "bg-ok/15 text-ok",
    processing: "bg-admin-info/15 text-admin-info",
    queued: "bg-warn/15 text-warn",
    failed: "bg-danger/15 text-danger",
    disabled: "bg-danger/15 text-danger",
    online: "bg-ok/15 text-ok",
    connected: "bg-ok/15 text-ok",
    idle: "bg-ok/15 text-ok",
    busy: "bg-warn/15 text-warn",
    offline: "bg-danger/15 text-danger",
    degraded: "bg-warn/15 text-warn",
    critical: "bg-danger/15 text-danger",
    warning: "bg-warn/15 text-warn",
  };
  const label = normalized === "only-fitment" ? "Fitment Only" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[normalized] ?? "bg-card-2 text-mute"}`}>
      {label}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="inline-flex rounded-full bg-violet/15 px-2.5 py-0.5 text-xs font-semibold text-violet-bright">
      {modeLabel(mode)}
    </span>
  );
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-line bg-admin-card p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="px-3 py-10 text-center text-sm text-mute">{message}</p>;
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg bg-admin-card-2" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-3 py-10 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <button type="button" className="mt-3 text-sm text-violet-bright" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
    if (totalPages <= 7) {
      return index + 1;
    }
    const start = Math.max(1, Math.min(page - 3, totalPages - 6));
    return start + index;
  });
  return (
    <div className="mt-4 flex items-center justify-end gap-1 text-sm">
      <button
        type="button"
        className="min-h-9 rounded-btn border border-line px-3 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      {pages.map((value) => (
        <button
          key={value}
          type="button"
          className={`min-h-9 min-w-9 rounded-btn px-2 ${value === page ? "bg-[image:var(--ss-cta)] text-white" : "border border-line"}`}
          onClick={() => onPage(value)}
        >
          {value}
        </button>
      ))}
      <button
        type="button"
        className="min-h-9 rounded-btn border border-line px-3 disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </div>
  );
}

export function AdminTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-px">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            value === tab ? "border-violet-bright text-ink" : "border-transparent text-mute"
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-10 rounded-field border border-line bg-admin-card-2 px-3 text-sm text-ink outline-none placeholder:text-faint"
    />
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 rounded-field border border-line bg-admin-card-2 px-3 text-sm text-ink"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterSelect
      value={value}
      onChange={onChange}
      options={[
        { value: "1d", label: "Today" },
        { value: "7d", label: "Last 7 days" },
        { value: "30d", label: "Last 30 days" },
        { value: "90d", label: "Last 90 days" },
      ]}
    />
  );
}

export function AdminConfirm({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-[14px] border border-line bg-admin-card p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-mute">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="min-h-10 rounded-btn border border-line px-4 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="min-h-10 rounded-btn px-4 text-sm font-semibold text-white"
            style={{ backgroundImage: "var(--ss-cta)" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 items-center rounded-btn px-4 text-sm font-semibold text-white disabled:opacity-50"
      style={{ backgroundImage: "var(--ss-cta)" }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} className="inline-flex min-h-10 items-center rounded-btn border border-line px-4 text-sm font-semibold">
      {children}
    </button>
  );
}
