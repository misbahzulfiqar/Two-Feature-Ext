type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className="progress-row">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label="Listing progress"
      >
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-percent">{clamped}%</span>
    </div>
  );
}
