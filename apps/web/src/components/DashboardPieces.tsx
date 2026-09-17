export function DashboardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-mute">{subtitle}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-5 text-center">
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm text-mute">{label}</p>
    </div>
  );
}

export function ProgressSteps({ step, total }: { step: number; total: number }) {
  const percent = Math.round((step / total) * 100);
  return (
    <div className="mb-8">
      <p className="mb-2 text-sm font-medium text-mute">
        Step {step} of {total}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundImage: "var(--ss-cta)" }}
        />
      </div>
    </div>
  );
}
