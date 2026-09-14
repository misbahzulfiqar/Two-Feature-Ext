import { useId, useState } from "react";
import { ChevronIcon } from "./Icons.tsx";
import {
  SCRAPE_MODES,
  scrapeModeLabel,
  type ScrapeMode,
} from "./scrape-mode.ts";

type ScrapeModeSelectProps = {
  id: string;
  value: ScrapeMode;
  disabled?: boolean;
  onChange: (mode: ScrapeMode) => void;
};

export function ScrapeModeSelect({
  id,
  value,
  disabled = false,
  onChange,
}: ScrapeModeSelectProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  function selectMode(mode: ScrapeMode): void {
    onChange(mode);
    setOpen(false);
  }

  return (
    <div className="mode-dropdown">
      <button
        type="button"
        id={id}
        className="mode-dropdown-trigger"
        disabled={disabled}
        aria-label="Scrape mode"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="mode-dropdown-value">{scrapeModeLabel(value)}</span>
        <span className="chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {open ? (
        <>
          <div
            className="options-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="mode-dropdown-menu" id={menuId} role="listbox" aria-label="Scrape mode">
            {SCRAPE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="option"
                className={
                  mode === value ? "mode-dropdown-option is-selected" : "mode-dropdown-option"
                }
                aria-selected={mode === value}
                onClick={() => selectMode(mode)}
              >
                {scrapeModeLabel(mode)}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
