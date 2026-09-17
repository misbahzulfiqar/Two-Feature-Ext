import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const navigate = useNavigate();
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  async function logout() {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-[image:var(--ss-cta)] text-xs font-bold text-white">
        {initials}
      </summary>
      <div className="absolute right-0 mt-2 w-56 rounded-card border border-line bg-card-2 p-3 text-sm shadow-cta">
        <p className="font-semibold">{name}</p>
        <p className="truncate text-mute">{email}</p>
        <Link to="/settings" className="mt-3 block text-mute hover:text-ink">
          Settings
        </Link>
        <button type="button" className="mt-2 text-danger" onClick={() => void logout()}>
          Logout
        </button>
      </div>
    </details>
  );
}
