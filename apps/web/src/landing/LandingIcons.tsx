import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ChromeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M12 3v6M7.2 20.1 10.4 14M16.8 20.1 13.6 14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 8.8v6.4L16 12 10 8.8Z" fill="currentColor" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="9" fill="#22c55e" />
      <path
        d="M6 10.2 8.6 13 14 7.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScrapeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect x="6" y="7" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11h6M12 15h6M12 19h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M20 13h5l1 3-3 8h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path
        d="M8 24h4.2L23 13.2 18.8 9 8 19.8V24Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M17.2 10.6 21.4 14.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect x="8" y="14" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M11.5 14V11a4.5 4.5 0 0 1 9 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path d="M8 6v20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 7h14l-3 5 3 5H8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <path d="M15 3 6 16h8l-1 9 10-14h-8L15 3Z" fill="currentColor" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <rect x="4" y="6" width="20" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="12" r="1.8" fill="currentColor" />
      <path d="M5 19l6-5 4 3 4-4 5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function FitmentIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <circle cx="14" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 8v6l4 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <path
        d="M14 4 6 8v7c0 5 3.6 8.4 8 9.8 4.4-1.4 8-4.8 8-9.8V8l-8-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M10.5 14.2 13 16.6 18 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 80 64" aria-hidden="true" {...props}>
      <path
        d="M30 8C16 8 8 18 8 32c0 10 6 18 16 18 8 0 14-6 14-14 0-8-6-14-14-14-1 0-3 0-4 .2C21 16 26 12 32 12l-2-4Zm42 0C58 8 50 18 50 32c0 10 6 18 16 18 8 0 14-6 14-14 0-8-6-14-14-14-1 0-3 0-4 .2C63 16 68 12 74 12l-2-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
