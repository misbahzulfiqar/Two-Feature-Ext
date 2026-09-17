import { useState, type InputHTMLAttributes } from "react";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.8 3.2M9.9 5.1A10.5 10.5 0 0 1 12 5c5.5 0 9.5 4.5 10.5 7-.4.9-1.1 2-2.1 3.1M6.1 6.2C4.4 7.5 3.2 9.1 2.5 12 3.5 14.5 7.5 19 12 19c1.4 0 2.7-.4 3.9-1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M2.5 12C3.5 9.5 7.5 5 12 5s8.5 4.5 9.5 7c-1 2.5-5 7-9.5 7s-8.5-4.5-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function FormInput({
  label,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      <span className="relative block">
        <input
          {...props}
          type={isPassword && visible ? "text" : type}
          className={`h-10 w-full rounded-field border border-line bg-card-2 px-3 text-sm text-ink outline-none transition duration-200 placeholder:text-faint focus:border-violet-bright ${
            isPassword ? "pr-10" : ""
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-mute hover:text-ink"
            onClick={() => setVisible((open) => !open)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            <PasswordVisibilityIcon visible={visible} />
          </button>
        ) : null}
      </span>
    </label>
  );
}
