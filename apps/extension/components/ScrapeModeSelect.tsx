import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "./Icons.tsx";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent): void {
      const path = event.composedPath();
      if (rootRef.current && path.includes(rootRef.current)) {
        return;
      }
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div
      className={open ? "mode-select is-open" : "mode-select"}
      ref={rootRef}
    >
      <button
        id={id}
        type="button"
        className="mode-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{scrapeModeLabel(value)}</span>
        <span className="chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      {open ? (
        <ul className="mode-select-menu" role="listbox" aria-labelledby={id}>
          {SCRAPE_MODES.map((mode) => (
            <li key={mode} role="none">
              <button
                type="button"
                role="option"
                aria-selected={mode === value}
                className={mode === value ? "is-selected" : undefined}
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
              >
                {scrapeModeLabel(mode)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
