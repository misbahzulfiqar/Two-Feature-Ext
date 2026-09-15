import { useId, useState } from "react";
import { ChecklistIcon } from "./Icons.tsx";
import {
  FILL_OPTIONS,
  allEnabled,
  countEnabled,
  type FillOptions,
} from "./fill-options.ts";

type FillOptionsMenuProps = {
  value: FillOptions;
  disabled?: boolean;
  onChange: (next: FillOptions) => void;
};

/**
 * Icon-only trigger opening a checkbox list of the steps a full scrape will
 * apply. Rendered inside the panel's shadow root, so the dismiss backdrop is a
 * sibling element rather than a document-level listener.
 */
export function FillOptionsMenu({
  value,
  disabled = false,
  onChange,
}: FillOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const selected = countEnabled(value);

  function toggleOption(id: keyof FillOptions): void {
    onChange({ ...value, [id]: !value[id] });
  }

  function setAll(next: boolean): void {
    const updated = { ...value };
    for (const option of FILL_OPTIONS) {
      updated[option.id] = next;
    }
    onChange(updated);
  }

  return (
    <div className="options-menu">
      <button
        type="button"
        className={isOpen ? "icon-button is-active" : "icon-button"}
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Choose what to fill (${selected} of ${FILL_OPTIONS.length} selected)`}
        title={`Choose what to fill (${selected} of ${FILL_OPTIONS.length} selected)`}
      >
        <ChecklistIcon />
        {allEnabled(value) ? null : <span className="icon-button-dot" aria-hidden="true" />}
      </button>

      {isOpen ? (
        <>
          <div
            className="options-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="options-popover" id={menuId} role="group" aria-label="Fields to fill">
            <div className="options-popover-head">
              <span>Fill these fields</span>
              <div className="options-popover-actions">
                <button type="button" onClick={() => setAll(true)}>
                  All
                </button>
                <button type="button" onClick={() => setAll(false)}>
                  None
                </button>
              </div>
            </div>
            {FILL_OPTIONS.map((option) => (
              <label key={option.id} className="options-item">
                <input
                  type="checkbox"
                  checked={value[option.id]}
                  onChange={() => toggleOption(option.id)}
                />
                <span className="options-item-label">{option.label}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
