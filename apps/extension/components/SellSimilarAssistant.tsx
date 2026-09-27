import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ScrapeProgressStage, VehicleCompatibility } from "@sell-similar/contracts";
import {
  captureFitmentTargetEditor,
  fillEbayListingFitment,
  type FillFitmentResult,
} from "../lib/fill-ebay-fitment.ts";
import { fillEbayListingSpecifics } from "../lib/fill-ebay-specifics.ts";
import { fitmentLog } from "../lib/fitment-debug.ts";
import { progressForStage } from "../lib/scrape-progress.ts";
import {
  captureListingScroll,
  restoreListingPage,
  restoreListingScroll,
} from "../lib/restore-listing-page.ts";
import {
  readScrapeProgress,
  reportApplyResult,
  scrapeSourceListing,
} from "../lib/scrape-source-title.ts";
import { ControlField } from "./ControlField.tsx";
import { FieldRow } from "./FieldRow.tsx";
import { CheckCircleIcon, ChevronIcon, SparkleIcon } from "./Icons.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import "./SellSimilarAssistant.css";

const SAMPLE_SOURCE_URL = "https://www.ebay.com/itm/453712381834";

const FILL_MODES = [
  { id: "specs-and-fitment", label: "Specs & fitment" },
  { id: "fitment-only", label: "Fitment only" },
  { id: "specs-only", label: "Specs only" },
] as const;

type FillMode = (typeof FILL_MODES)[number]["id"];

export function SellSimilarAssistant() {
  const [fillMode, setFillMode] = useState<FillMode>("specs-and-fitment");
  const [fillMenuOpen, setFillMenuOpen] = useState(false);
  const fillMenuId = useId();
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showFitmentReload, setShowFitmentReload] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const isBusy = isProcessing;

  function selectFillMode(mode: FillMode): void {
    setFillMode(mode);
    setFillMenuOpen(false);
  }

  function handleSourceChange(event: ChangeEvent<HTMLInputElement>): void {
    setSource(event.target.value);
  }

  function fitmentSummary(result: FillFitmentResult, total: number): string {
    const existing =
      result.existingCount > 0 ? ` Captured ${result.existingCount} existing target vehicles.` : "";
    switch (result.code) {
      case "FITMENT_EMPTY":
        return `FITMENT_EMPTY. Existing target fitment not updated.${existing}`;
      case "TARGET_EDITOR_CHANGED":
        return "TARGET_EDITOR_CHANGED. Stopped before replacing target fitment.";
      case "FITMENT_PICKER_TIMEOUT":
        return (
          result.warnings.find((warning) => warning.startsWith("FITMENT_PICKER_TIMEOUT")) ??
          "FITMENT_PICKER_TIMEOUT"
        );
      case "VERIFICATION_FAILED": {
        const failed =
          result.warnings.find((warning) => warning.startsWith("Failed to apply:")) ??
          result.warnings.find((warning) => warning.startsWith("VERIFICATION_FAILED")) ??
          result.warnings[0] ??
          "Exact option not found.";
        return `VERIFICATION_FAILED. Did not save fitment; source and target did not match (${result.filled} of ${total} verified). ${failed.replace(/\n/g, " — ")}`;
      }
      case undefined:
        break;
      default: {
        const exhaustive: never = result.code;
        throw new Error(`Unhandled fitment code: ${String(exhaustive)}`);
      }
    }
    if (total === 0) {
      return `FITMENT_EMPTY. Existing target fitment left unchanged.${existing}`;
    }
    if (!result.sectionFound) {
      return result.warnings[0] ?? "Could not find the fitment section on this editor.";
    }
    if (result.sectionFound && result.filled >= total && result.skipped === 0) {
      return `✅ Fitment saved: ${total} vehicle${total === 1 ? "" : "s"}`;
    }
    const pickerFailed = result.warnings.find(
      (warning) =>
        warning.startsWith("FITMENT_PICKER_TIMEOUT") ||
        warning.includes("Failed to open Fitment modal") ||
        warning.includes("Fitment picker never became ready"),
    );
    if (pickerFailed) {
      return pickerFailed;
    }
    const failed =
      result.warnings.find((warning) => warning.startsWith("Failed to apply:")) ??
      result.warnings[0] ??
      "Exact option not found.";
    return `VERIFICATION_FAILED. Did not save fitment; source and target did not match (${result.filled} of ${total} verified). ${failed.replace(/\n/g, " — ")}`;
  }

  /**
   * The scrape is one blocking request, so the worker's real stage is only
   * visible by short-interval HTTP polling (~5s). MVP does not keep a
   * persistent WebSocket. Stops as soon as the scrape returns.
   */
  async function withLiveScrapeStatus<T>(run: () => Promise<T>): Promise<T> {
    let polling = true;
    const poll = async (): Promise<void> => {
      while (polling) {
        const message = await readScrapeProgress();
        if (polling && message) {
          setStatusMessage(message);
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 5000);
        });
      }
    };
    void poll();
    try {
      return await run();
    } finally {
      polling = false;
    }
  }
  function advanceProgress(stage: ScrapeProgressStage): void {
    const next = progressForStage(stage);
    setProgress((current) => (next >= current ? next : current));
  }

  async function applyNormalizedFitment(rows: VehicleCompatibility[]): Promise<FillFitmentResult> {
    if (rows.length === 0) {
      setStatusMessage("FITMENT_EMPTY. Existing target fitment left unchanged.");
      advanceProgress("normalize");
      return fillEbayListingFitment(rows);
    }

    setStatusMessage(
      `Normalizing source fitment. Found ${rows.length} compatible vehicle${rows.length === 1 ? "" : "s"}.`,
    );
    advanceProgress("normalize");
    setStatusMessage(
      `Preparing target fitment editor. Found ${rows.length} compatible vehicle${rows.length === 1 ? "" : "s"}.`,
    );
    advanceProgress("target_prepare");

    const result = await fillEbayListingFitment(rows);
    advanceProgress("apply_fitment_media");
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setIsComplete(false);
    setShowFitmentReload(false);
    setProgress(progressForStage("queued"));
    setStatusMessage("");
    const scrollBefore = captureListingScroll();
    captureFitmentTargetEditor();
    fitmentLog("1 Process Listing clicked", `mode=${fillMode}`);

    try {
      switch (fillMode) {
        case "specs-and-fitment": {
          setStatusMessage("Opening eBay listing...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape"),
          );
          setProgress(progressForStage("listing_extract"));
          await new Promise((resolve) => {
            window.setTimeout(resolve, 200);
          });

          setProgress(progressForStage("target_prepare"));
          setStatusMessage("Replacing item specifics...");
          const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
          setProgress(progressForStage("apply_core"));

          setStatusMessage(
            `Applying vehicle compatibility. Found ${listing.compatibility.length} compatible vehicle${listing.compatibility.length === 1 ? "" : "s"}.`,
          );
          const fitmentResult = await applyNormalizedFitment(listing.compatibility);
          if (fitmentResult.filled > 0) {
            setShowFitmentReload(true);
          }

          await restoreListingPage();
          setProgress(progressForStage("complete"));
          const specificsText =
            listing.itemSpecifics.length === 0
              ? "No item specifics found"
              : `Filled ${specResult.filled} of ${listing.itemSpecifics.length} item specifics`;
          setStatusMessage(
            `${specificsText}. ${fitmentSummary(fitmentResult, listing.compatibility.length)}.`,
          );
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: fitmentResult.filled,
            imageCount: 0,
            warningCount: fitmentResult.warnings.length,
            warnings: fitmentResult.warnings,
          });
          setIsComplete(true);
          break;
        }
        case "specs-only": {
          setStatusMessage("Opening eBay listing...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape"),
          );
          setProgress(progressForStage("listing_extract"));
          await new Promise((resolve) => {
            window.setTimeout(resolve, 200);
          });

          setProgress(progressForStage("target_prepare"));
          setStatusMessage("Replacing item specifics...");
          const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          setStatusMessage(
            listing.itemSpecifics.length === 0
              ? "No item specifics found."
              : `Filled ${specResult.filled} of ${listing.itemSpecifics.length} item specifics.`,
          );
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: 0,
            imageCount: 0,
            warningCount: 0,
            warnings: [],
          });
          setIsComplete(true);
          break;
        }
        case "fitment-only": {
          setStatusMessage("Opening eBay listing...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "only-fitment"),
          );
          setStatusMessage("Extracting vehicle compatibility...");
          setProgress(progressForStage("fitment_extract"));
          const fitmentResult = await applyNormalizedFitment(listing.compatibility);
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          setStatusMessage(fitmentSummary(fitmentResult, listing.compatibility.length));
          if (fitmentResult.filled > 0) {
            setShowFitmentReload(true);
          }
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: fitmentResult.filled,
            imageCount: 0,
            warningCount: fitmentResult.warnings.length,
            warnings: fitmentResult.warnings,
          });
          setIsComplete(true);
          break;
        }
        default: {
          const exhaustive: never = fillMode;
          throw new Error(`Unhandled fill mode: ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      setProgress(0);
      setIsComplete(false);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not scrape listing",
      );
    } finally {
      await restoreListingPage();
      restoreListingScroll(scrollBefore);
      setIsProcessing(false);
    }
  }

  return (
    <section
      ref={rootRef}
      className={isBusy ? "assistant is-busy" : "assistant"}
      aria-label="Sell Similar Assistant"
    >
      <form className="assistant-form" onSubmit={handleSubmit}>
        <FieldRow label="Fill" htmlFor="fill-mode">
          <div className={fillMenuOpen ? "mode-dropdown is-open" : "mode-dropdown"}>
            <button
              type="button"
              id="fill-mode"
              className="mode-dropdown-trigger"
              disabled={isProcessing}
              aria-haspopup="listbox"
              aria-expanded={fillMenuOpen}
              aria-controls={fillMenuId}
              onClick={() => setFillMenuOpen((open) => !open)}
            >
              <span className="mode-dropdown-value">
                {FILL_MODES.find((mode) => mode.id === fillMode)?.label}
              </span>
              <span className="chevron" aria-hidden="true">
                <ChevronIcon />
              </span>
            </button>
            {fillMenuOpen ? (
              <>
                <div
                  className="options-backdrop"
                  onClick={() => setFillMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="mode-dropdown-menu" id={fillMenuId} role="listbox" aria-label="Fill">
                  {FILL_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      role="option"
                      className={
                        mode.id === fillMode
                          ? "mode-dropdown-option is-selected"
                          : "mode-dropdown-option"
                      }
                      aria-selected={mode.id === fillMode}
                      onClick={() => selectFillMode(mode.id)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </FieldRow>

        <FieldRow label="Source URL / ID" htmlFor="source-url">
          <ControlField>
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

        <div className="form-actions">
          <button className="process-button" type="submit" disabled={isProcessing}>
            <SparkleIcon />
            {isProcessing ? "Processing..." : "Scrape & fill"}
          </button>
        </div>
      </form>

      {isProcessing || isComplete ? (
        <div className="assistant-progress">
          {isProcessing ? (
            <>
              <div className="progress-meta">
                <span className="processing-label">
                  <span className="processing-dot" aria-hidden="true" />
                  Processing...
                </span>
                <span className="running-badge">
                  <span className="running-dot" aria-hidden="true" />
                  Running
                </span>
              </div>
              <ProgressBar value={progress} />
            </>
          ) : (
            <div className="complete-row">
              <span className="complete-label">
                <CheckCircleIcon />
                Listing filled
              </span>
              <div className="complete-actions">
                {showFitmentReload ? (
                  <button
                    type="button"
                    className="reload-button"
                    onClick={() => {
                      window.location.reload();
                    }}
                    title="Reload the listing page so eBay can show saved vehicles and Edit works"
                  >
                    Reload to view & edit
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="activity" aria-live="polite">
        <SparkleIcon />
        <p className="activity-copy">
          {statusMessage ? (
            <span className="activity-status">{statusMessage}</span>
          ) : (
            <span className="activity-status activity-status--idle">
              Choose what to fill, then scrape and fill
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
