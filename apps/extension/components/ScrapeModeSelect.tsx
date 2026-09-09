import {
  SCRAPE_MODES,
  scrapeModeLabel,
  type ScrapeMode,
} from "./scrape-mode.ts";

type ScrapeModeSelectProps = {
  id: string;
  value: ScrapeMode;
  onChange: (mode: ScrapeMode) => void;
};

export function ScrapeModeSelect({
  id,
  value,
  onChange,
}: ScrapeModeSelectProps) {
  return (
    <div className="mode-select" id={id} role="radiogroup" aria-label="Scrape mode">
      {SCRAPE_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={mode === value}
          className={mode === value ? "mode-select-option is-selected" : "mode-select-option"}
          onClick={() => onChange(mode)}
        >
          {scrapeModeLabel(mode)}
        </button>
      ))}
    </div>
  );
}
