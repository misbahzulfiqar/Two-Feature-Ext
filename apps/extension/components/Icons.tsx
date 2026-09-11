type IconProps = {
  className?: string;
};

const ICON_SIZE = 18;

function iconSvgProps(className: string | undefined) {
  return {
    className,
    width: ICON_SIZE,
    height: ICON_SIZE,
    "aria-hidden": true as const,
  };
}

export function BagIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
      <path d="M12 12.5v3" />
      <path d="m10.5 13.5 1.5-1 1.5 1" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </svg>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 7 2 2 3-3" />
      <path d="m3 15 2 2 3-3" />
      <path d="M12 8h9" />
      <path d="M12 16h9" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...iconSvgProps(className)} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0c.35 2.6 1.4 4.4 4 5-2.6.6-3.65 2.4-4 5-.35-2.6-1.4-4.4-4-5 2.6-.6 3.65-2.4 4-5Z" />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13.3 18.77" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function RocketIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15c-3-1-5-5-5-9 4 0 8 2 9 5 0 4-4 6-4 6Z" />
      <path d="m9 12-5 2 3 3 2-5Z" />
      <path d="M12.5 8.5 15 6" />
      <circle cx="14.2" cy="9.8" r="1" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg
      {...iconSvgProps(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
    </svg>
  );
}
