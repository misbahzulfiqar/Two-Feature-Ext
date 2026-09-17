export function AppLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight ${className}`}>
      <img src="/logo.png?v=4" alt="" className="h-11 w-11 object-contain" />
      eBay Sell Similar
    </span>
  );
}
