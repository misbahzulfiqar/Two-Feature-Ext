import { useState, type ChangeEvent, type FormEvent } from "react";
import type { ScrapeProgressStage, VehicleCompatibility } from "@sell-similar/contracts";
import { fillEbayListingCategories } from "../lib/fill-ebay-categories.ts";
import { fillEbayListingCondition } from "../lib/fill-ebay-condition.ts";
import {
  captureFitmentTargetEditor,
  fillEbayListingFitment,
  type FillFitmentResult,
} from "../lib/fill-ebay-fitment.ts";
import { fillEbayListingImages } from "../lib/fill-ebay-images.ts";
import { fillEbayListingSpecifics } from "../lib/fill-ebay-specifics.ts";
import { fillEbayListingTitle } from "../lib/fill-ebay-title.ts";
import { fitmentLog } from "../lib/fitment-debug.ts";
import { progressForStage } from "../lib/scrape-progress.ts";
import { restoreListingPage } from "../lib/restore-listing-page.ts";
import { scrapeSourceListing } from "../lib/scrape-source-title.ts";
import { ControlField } from "./ControlField.tsx";
import { FieldRow } from "./FieldRow.tsx";
import { SparkleIcon } from "./Icons.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import type { ScrapeMode } from "./scrape-mode.ts";
import "./SellSimilarAssistant.css";

const SAMPLE_SOURCE_URL = "https://www.ebay.com/itm/453712381834";

export function SellSimilarAssistant() {
  const [scrapeMode, setScrapeMode] = useState<ScrapeMode>("full-scrape");
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  function handleScrapeModeChange(mode: ScrapeMode): void {
    setScrapeMode(mode);
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
      return (
        result.warnings[0] ??
        "Could not find the fitment section on this editor."
      );
    }
    if (result.sectionFound && result.filled >= total && result.skipped === 0) {
      return `Fitment applied successfully. ${total} source row${total === 1 ? "" : "s"} matched.${existing}`;
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
    setProgress(progressForStage("queued"));
    setStatusMessage("");
    captureFitmentTargetEditor();
    fitmentLog("1 Process Listing clicked", `mode=${scrapeMode}`);

    try {
      switch (scrapeMode) {
        case "full-scrape": {
          setStatusMessage("Opening eBay listing...");
          setProgress(progressForStage("source_load"));
          const listing = await scrapeSourceListing(source, "full-scrape");
          setProgress(progressForStage("listing_extract"));
          await new Promise((resolve) => {
            window.setTimeout(resolve, 200);
          });

          if (!listing.title) {
            setProgress(progressForStage("complete"));
            setStatusMessage("Could not find a title on that listing");
            return;
          }

          setStatusMessage("Populating listing editor...");
          setProgress(progressForStage("target_prepare"));
          const filledTitle = fillEbayListingTitle(listing.title);
          setProgress(progressForStage("apply_core"));

          setStatusMessage("Adding photos...");
          const filledImages = await fillEbayListingImages(listing.images);
          setProgress(progressForStage("apply_core"));

          setStatusMessage("Updating item category...");
          console.log("[SellSimilar][item-category] assistant calling fill", listing.category);
          const categoryResult = await fillEbayListingCategories(listing.category);
          console.log("[SellSimilar][item-category] assistant result", categoryResult);
          setProgress(progressForStage("apply_core"));
          await new Promise((resolve) => {
            window.setTimeout(resolve, 700);
          });

          setStatusMessage("Updating item condition...");
          console.log("[SellSimilar][condition] assistant calling fill", {
            condition: listing.condition,
            conditionDescription: listing.conditionDescription,
          });
          let conditionResult = await fillEbayListingCondition(
            listing.condition,
            listing.conditionDescription,
          );
          console.log("[SellSimilar][condition] assistant result", conditionResult);
          setProgress(progressForStage("apply_core"));

          setStatusMessage("Replacing item specifics...");
          const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
          setProgress(progressForStage("apply_core"));

          if (listing.conditionDescription) {
            conditionResult = await fillEbayListingCondition(
              listing.condition,
              listing.conditionDescription,
            );
          }

          setStatusMessage(
            `Applying vehicle compatibility. Found ${listing.compatibility.length} compatible vehicle${listing.compatibility.length === 1 ? "" : "s"}.`,
          );
          const fitmentResult = await applyNormalizedFitment(listing.compatibility);
          await restoreListingPage();
          setProgress(progressForStage("complete"));

          const photoSummary =
            listing.images.length === 0
              ? "No photos found"
              : filledImages === 0
                ? `Found ${listing.images.length} photos, but the photo uploader was not on this page`
                : `Added ${filledImages} photo${filledImages === 1 ? "" : "s"}`;
          const specSummary =
            listing.itemSpecifics.length === 0
              ? "no item specifics found"
              : `filled ${specResult.filled} of ${listing.itemSpecifics.length} item specifics`;
          const categorySummary = categoryResult.itemCategory
            ? `updated item category (${listing.category.path.join(" > ") || listing.category.name})`
            : listing.category.path.length || listing.category.name
              ? `could not update item category (${listing.category.path.join(" > ") || listing.category.name})`
              : "no item category found";

          const titleSummary = filledTitle
            ? "Filled title"
            : "Could not fill the Title field";
          const conditionSummary = conditionResult.condition
            ? `updated item condition (${listing.condition})`
            : listing.condition
              ? `could not update item condition (${listing.condition})`
              : "no item condition found";
          const conditionDescSummary = conditionResult.conditionDescription
            ? "updated condition description"
            : listing.conditionDescription
              ? "could not update condition description"
              : "no condition description found";
          setStatusMessage(
            listing.compatibility.length === 0
              ? `${titleSummary}. ${photoSummary}. ${specSummary}. ${categorySummary}. ${conditionSummary}. ${conditionDescSummary}. ${fitmentSummary(fitmentResult, listing.compatibility.length)}`
              : fitmentResult.filled === listing.compatibility.length && fitmentResult.skipped === 0
                ? `${titleSummary}. ${photoSummary}. ${specSummary}. ${categorySummary}. ${conditionSummary}. ${conditionDescSummary}. Fitment copied exactly. ${fitmentSummary(fitmentResult, listing.compatibility.length)}`
                : `${titleSummary}. ${photoSummary}. ${specSummary}. ${categorySummary}. ${conditionSummary}. ${conditionDescSummary}. Fitment was not saved. ${fitmentSummary(fitmentResult, listing.compatibility.length)}`,
          );
          return;
        }
        case "only-fitment": {
          setStatusMessage("Waiting for an available worker...");
          setProgress(progressForStage("queued"));
          setStatusMessage("Opening and validating the source eBay listing.");
          setProgress(progressForStage("source_load"));
          const listing = await scrapeSourceListing(source, "only-fitment");
          setStatusMessage("Extracting vehicle compatibility...");
          setProgress(progressForStage("fitment_extract"));
          const fitmentResult = await applyNormalizedFitment(listing.compatibility);
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          setStatusMessage(fitmentSummary(fitmentResult, listing.compatibility.length));
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
        error instanceof Error ? error.message : "Could not scrape listing",
      );
    } finally {
      await restoreListingPage();
      setIsProcessing(false);
    }
  }

  return (
    <section className="assistant" aria-label="Sell Similar Assistant">
      <form className="assistant-form" onSubmit={handleSubmit}>
        <FieldRow label="Scrape mode" htmlFor="scrape-mode">
          <div className="mode-select" id="scrape-mode" role="radiogroup" aria-label="Scrape mode">
            <button
              type="button"
              role="radio"
              aria-checked={scrapeMode === "full-scrape"}
              className={scrapeMode === "full-scrape" ? "mode-select-option is-selected" : "mode-select-option"}
              onClick={() => handleScrapeModeChange("full-scrape")}
            >
              Full Scrape
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scrapeMode === "only-fitment"}
              className={scrapeMode === "only-fitment" ? "mode-select-option is-selected" : "mode-select-option"}
              onClick={() => handleScrapeModeChange("only-fitment")}
            >
              Fitment only
            </button>
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
