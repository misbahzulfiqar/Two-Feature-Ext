export function ChromeIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#fff" />
      <path d="M24 4a20 20 0 0 1 17.3 10H24a10 10 0 0 0-8.6 5L9.2 9.2A20 20 0 0 1 24 4Z" fill="#EA4335" />
      <path d="M41.3 14A20 20 0 0 1 24 44l6.2-10.8A10 10 0 0 0 24 24h17.3Z" fill="#FBBC05" />
      <path d="M9.2 9.2 15.4 19A10 10 0 0 0 24 34L6.7 34A20 20 0 0 1 9.2 9.2Z" fill="#34A853" />
      <circle cx="24" cy="24" r="8" fill="#4285F4" />
    </svg>
  );
}

export function PuzzleIcon({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M12 18h14v-4a6 6 0 1 1 12 0v4h14v14h-4a6 6 0 1 0 0 12h4v14H38v-4a6 6 0 1 0-12 0v4H12V44h4a6 6 0 1 0 0-12h-4V18Z"
        fill="url(#ss-puzzle)"
      />
      <defs>
        <linearGradient id="ss-puzzle" x1="8" y1="8" x2="56" y2="56">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
    </svg>
  );
}
