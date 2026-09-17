import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";
import { PageContainer } from "./LayoutBits";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
] as const;

export function DashboardNavbar({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-line bg-page">
      <PageContainer className="flex h-16 items-center gap-4">
        <Link to="/dashboard" className="text-ink">
          <AppLogo />
        </Link>
        <nav className="ml-auto hidden items-center gap-5 text-sm font-medium text-mute md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} to={link.href} className="transition hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-line md:hidden"
          aria-label="Open menu"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <UserMenu name={name} email={email} />
      </PageContainer>
      {open ? (
        <div className="border-t border-line bg-card px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-shell flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <Link key={link.href} to={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
