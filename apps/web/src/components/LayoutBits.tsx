import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-shell px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function DarkCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/15 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral" | "danger";
  children: ReactNode;
}) {
  const tones = {
    success: "bg-ok/15 text-ok",
    warning: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    neutral: "bg-white/10 text-mute",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
