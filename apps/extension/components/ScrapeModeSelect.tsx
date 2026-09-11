import { ControlField } from "./ControlField.tsx";
import {
  SCRAPE_MODES,
  isScrapeMode,
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
  return (
    <ControlField showChevron>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-label="Scrape mode"
        onChange={(event) => {
          const next = event.target.value;
          if (isScrapeMode(next)) {
            onChange(next);
          }
        }}
      >
        {SCRAPE_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {scrapeModeLabel(mode)}
          </option>
        ))}
      </select>
    </ControlField>
  );
}
