import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const ctaClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-5 py-2.5 text-sm font-semibold text-white shadow-cta transition duration-200 hover:-translate-y-0.5 hover:brightness-110";

function isAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function GradientButton({
  href,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; children: ReactNode }) {
  const classes = `${ctaClass} disabled:pointer-events-none disabled:opacity-50 ${className}`;
  const style = { backgroundImage: "var(--ss-cta)" };
  if (href) {
    if (isAppPath(href)) {
      return (
        <Link to={href} className={classes} style={style}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={classes} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} style={style} {...props} type={type}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  href,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; children: ReactNode }) {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink transition duration-200 hover:border-violet-bright ${className}`;
  if (href) {
    if (isAppPath(href)) {
      return (
        <Link to={href} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...props} type={type}>
      {children}
    </button>
  );
}
