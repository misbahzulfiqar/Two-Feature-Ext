import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ControlField } from "./ControlField.tsx";
import { FieldRow } from "./FieldRow.tsx";
import { GlobeIcon, LayersIcon, LinkIcon, SparkleIcon } from "./Icons.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import {
  SCRAPE_MODES,
  isScrapeMode,
  scrapeModeLabel,
  type ScrapeMode,
} from "./scrape-mode.ts";
import "./SellSimilarAssistant.css";

const SAMPLE_SOURCE_URL = "https://www.ebay.com/itm/453712381834";

export function SellSimilarAssistant() {
  const [scrapeMode, setScrapeMode] = useState<ScrapeMode>("full-scrape");
  const [source, setSource] = useState(SAMPLE_SOURCE_URL);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [vehicleCount, setVehicleCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  function clearTimers(): void {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  }

  function queueTimeout(callback: () => void, delayMs: number): void {
    const timer = window.setTimeout(callback, delayMs);
    timersRef.current.push(timer);
  }

  function handleScrapeModeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const { value } = event.target;
    if (isScrapeMode(value)) {
      setScrapeMode(value);
    }
  }

  function handleSourceChange(event: ChangeEvent<HTMLInputElement>): void {
    setSource(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clearTimers();
    setIsProcessing(true);
    setProgress(8);
    setStatusMessage("Extracting vehicle compatibility...");
    setVehicleCount(0);

    queueTimeout(() => setProgress(36), 220);
    queueTimeout(() => setProgress(72), 480);
    queueTimeout(() => {
      setProgress(100);
      setVehicleCount(184);
      setIsProcessing(false);
      setStatusMessage("Listing details ready to fill");
    }, 720);
  }

  return (
    <section className="assistant" aria-label="Sell Similar Assistant">
      <form className="assistant-form" onSubmit={handleSubmit}>
        <FieldRow
          label="Scrape mode"
          hint="Choose what data you want to scrape"
          htmlFor="scrape-mode"
          icon={<LayersIcon />}
        >
          <ControlField showChevron>
            <select
              id="scrape-mode"
              name="scrapeMode"
              value={scrapeMode}
              onChange={handleScrapeModeChange}
            >
              {SCRAPE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {scrapeModeLabel(mode)}
                </option>
              ))}
            </select>
          </ControlField>
        </FieldRow>

        <FieldRow
          label="Source URL / ID"
          hint="Enter eBay listing URL or Item ID"
          htmlFor="source-url"
          icon={<LinkIcon />}
        >
          <ControlField leading={<GlobeIcon />}>
            <input
              id="source-url"
              name="source"
              type="text"
              value={source}
              placeholder={SAMPLE_SOURCE_URL}
              onChange={handleSourceChange}
              autoComplete="off"
              spellCheck={false}
            />
          </ControlField>
        </FieldRow>

        <button className="process-button" type="submit" disabled={isProcessing}>
          <SparkleIcon />
          {isProcessing ? "Processing..." : "Process Listing"}
        </button>
      </form>

      <div className="assistant-progress">
        <div className="progress-meta">
          <span className="processing-label">
            <span className="processing-dot" aria-hidden="true" />
            {isProcessing ? "Processing..." : "Ready"}
          </span>
          {isProcessing ? (
            <span className="running-badge">
              <span className="running-dot" aria-hidden="true" />
              Running
            </span>
          ) : null}
        </div>
        <ProgressBar value={progress} />
      </div>

      <div className="activity" aria-live="polite">
        <SparkleIcon />
        <p className="activity-copy">
          {statusMessage ? (
            <span className="activity-status">{statusMessage}</span>
          ) : (
            <span className="activity-status activity-status--idle">
              Enter a source listing and process to fill this form
            </span>
          )}
          {vehicleCount > 0 ? (
            <span className="activity-result">
              {" "}
              Found <span className="highlight">{vehicleCount}</span> compatible
              vehicles
            </span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
