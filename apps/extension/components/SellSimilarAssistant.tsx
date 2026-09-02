import { useState, type ChangeEvent, type FormEvent } from "react";
import { fillEbayListingTitle } from "../lib/fill-ebay-title.ts";
import { scrapeSourceTitle } from "../lib/scrape-source-title.ts";
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
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  function handleScrapeModeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const { value } = event.target;
    if (isScrapeMode(value)) {
      setScrapeMode(value);
    }
  }

  function handleSourceChange(event: ChangeEvent<HTMLInputElement>): void {
    setSource(event.target.value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setProgress(8);
    setStatusMessage("");

    try {
      switch (scrapeMode) {
        case "full-scrape": {
          setStatusMessage("Fetching listing title...");
          setProgress(28);
          const title = await scrapeSourceTitle(source);
          setProgress(72);

          if (!title) {
            setProgress(100);
            setStatusMessage("Could not find a title on that listing");
            return;
          }

          setStatusMessage("Filling Title field...");
          const filled = fillEbayListingTitle(title);
          setProgress(100);

          if (!filled) {
            setStatusMessage(
              `Found title, but the Title field was not on this page: ${title}`,
            );
            return;
          }

          setStatusMessage(`Filled title: ${title}`);
          return;
        }
        case "only-fitment": {
          setProgress(100);
          setStatusMessage("Fitment scrape is not implemented yet");
          return;
        }
        default: {
          const exhaustive: never = scrapeMode;
          throw new Error(`Unhandled scrape mode: ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      setProgress(0);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not scrape listing title",
      );
    } finally {
      setIsProcessing(false);
    }
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
        </p>
      </div>
    </section>
  );
}
