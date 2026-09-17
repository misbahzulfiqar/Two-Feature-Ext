import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";
import { DarkCard } from "./LayoutBits";

export function AuthShell({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-page">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_80%_20%,#3b1d8a55,transparent)]" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-[#2563eb22] blur-3xl" />
      <div className="relative flex items-center justify-between px-6 py-5">
        <AppLogo />
        <Link to={backHref} className="text-sm text-mute transition hover:text-ink">
          {backLabel}
        </Link>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <DarkCard className={`w-[calc(100%-32px)] max-w-[380px] p-5 sm:p-6`}>{children}</DarkCard>
      </div>
    </div>
  );
}
