import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";
import { GradientButton, SecondaryButton } from "./Buttons";
import { PageContainer } from "./LayoutBits";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#use-cases", label: "Use Cases" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/95">
      <PageContainer className="flex h-16 items-center gap-4">
        <Link to="/" className="text-ink">
          <AppLogo />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-medium text-mute lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <SecondaryButton href="/login">Login</SecondaryButton>
          <GradientButton href="/register">Sign Up</GradientButton>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-line sm:ml-2 lg:hidden"
          aria-label="Open menu"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
      </PageContainer>
      {open ? (
        <div className="border-t border-line bg-card px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-shell flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
            <SecondaryButton href="/login">Login</SecondaryButton>
            <GradientButton href="/register">Sign Up</GradientButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
