import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ScrapeProgressStage, VehicleCompatibility } from "@sell-similar/contracts";
import { fillEbayListingCategories } from "../lib/fill-ebay-categories.ts";
import {
  ensureConditionDescription,
  fillEbayListingCondition,
} from "../lib/fill-ebay-condition.ts";
import { fillEbayListingDescription } from "../lib/fill-ebay-description.ts";
import { fillEbayListingPrice } from "../lib/fill-ebay-price.ts";
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
import {
  captureListingScroll,
  restoreListingPage,
  restoreListingScroll,
} from "../lib/restore-listing-page.ts";
import {
  clearFilledListingFields,
  type ClearableField,
} from "../lib/clear-listing-fields.ts";
import {
  clearSourceListingCache,
  readScrapeProgress,
  reportApplyResult,
  scrapeSourceListing,
} from "../lib/scrape-source-title.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { ControlField } from "./ControlField.tsx";
import { FieldRow } from "./FieldRow.tsx";
import { FillOptionsMenu } from "./FillOptionsMenu.tsx";
import { CheckCircleIcon, SparkleIcon, TrashIcon } from "./Icons.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { ScrapeModeSelect } from "./ScrapeModeSelect.tsx";
import { DEFAULT_FILL_OPTIONS, type FillOptions } from "./fill-options.ts";
import type { ScrapeMode } from "./scrape-mode.ts";
import "./SellSimilarAssistant.css";

const SAMPLE_SOURCE_URL = "https://www.ebay.com/itm/453712381834";

export function SellSimilarAssistant() {
  const [scrapeMode, setScrapeMode] = useState<ScrapeMode>("full-scrape");
  const [fillOptions, setFillOptions] = useState<FillOptions>(DEFAULT_FILL_OPTIONS);
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingForm, setIsClearingForm] = useState(false);
  const [showFitmentReload, setShowFitmentReload] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const isBusy = isProcessing || isClearingForm;

  function handleScrapeModeChange(mode: ScrapeMode): void {
    setScrapeMode(mode);
  }

  function handleSourceChange(event: ChangeEvent<HTMLInputElement>): void {
    setSource(event.target.value);
  }

  async function handleClearCache(): Promise<void> {
    if (isProcessing || isClearingCache) {
      return;
    }
    setIsClearingCache(true);
    try {
      const result = await clearSourceListingCache(source);
      setStatusMessage(
        result.cleared > 0
          ? `Cleared cached scrape for item ${result.ebayItemId}. The next run will fetch from eBay.`
          : `Nothing was cached for item ${result.ebayItemId}. The next run will fetch from eBay.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not clear the cache",
      );
    } finally {
      setIsClearingCache(false);
    }
  }

  /**
   * Clears the eBay listing fields this extension fills. The source URL / ID
   * box is deliberately left alone so the same listing can be re-processed.
   */
  async function clearForm(): Promise<void> {
    setShowClearConfirm(false);
    setIsClearingForm(true);
    setIsComplete(false);
    setStatusMessage("Clearing the fields this extension filled...");

    const fields = new Set<ClearableField>();
    for (const field of ["title", "images", "specifics", "fitment"] as const) {
      if (fillOptions[field]) {
        fields.add(field);
      }
    }

    const scrollBefore = captureListingScroll();
    try {
      const result = await clearFilledListingFields(fields);
      const cleared =
        result.done.length > 0
          ? `Cleared ${result.done.join(", ")}.`
          : "";
      const failed =
        result.failed.length > 0
          ? ` Could not clear ${result.failed.join(", ")}.`
          : "";
      const untouched =
        " Item category and condition were left as they are - eBay requires a value for both.";
      setStatusMessage(
        result.done.length === 0 && result.failed.length === 0
          ? "Nothing selected to clear. Pick fields in the options menu first."
          : `${cleared}${failed}${untouched}`,
      );
      setProgress(0);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not clear the listing fields",
      );
    } finally {
      await restoreListingPage();
      restoreListingScroll(scrollBefore);
      setIsClearingForm(false);
    }
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
    fitmentLog("1 Process Listing clicked", `mode=${scrapeMode}`);

    try {
      switch (scrapeMode) {
        case "full-scrape": {
          setStatusMessage("Opening eBay listing...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape"),
          );
          setProgress(progressForStage("listing_extract"));
          await new Promise((resolve) => {
            window.setTimeout(resolve, 200);
          });

          if (!listing.title) {
            setProgress(progressForStage("complete"));
            setStatusMessage("Could not find a title on that listing");
            return;
          }

          setProgress(progressForStage("target_prepare"));

          let filledTitle = false;
          if (fillOptions.title) {
            setStatusMessage("Populating listing editor...");
            filledTitle = fillEbayListingTitle(listing.title);
            setProgress(progressForStage("apply_core"));
          }

          let priceResult = { price: false };
          if (fillOptions.price) {
            setStatusMessage("Updating price...");
            priceResult = await fillEbayListingPrice(listing.price);
            setProgress(progressForStage("apply_core"));
          }

          let filledImages = 0;
          if (fillOptions.images) {
            setStatusMessage("Adding photos...");
            filledImages = await fillEbayListingImages(listing.images);
            setProgress(progressForStage("apply_core"));
          }

          let categoryResult = { itemCategory: false };
          if (fillOptions.category) {
            setStatusMessage("Updating item category...");
            categoryResult = await fillEbayListingCategories(listing.category);
            setProgress(progressForStage("apply_core"));
            await new Promise((resolve) => {
              window.setTimeout(resolve, 700);
            });
          }

          let conditionResult = { condition: false, conditionDescription: false };
          if (fillOptions.condition) {
            setStatusMessage("Updating item condition...");
            conditionResult = await fillEbayListingCondition(
              listing.condition,
              listing.conditionDescription,
            );
            setProgress(progressForStage("apply_core"));
          }

          let specResult = { filled: 0 };
          if (fillOptions.specifics) {
            setStatusMessage("Replacing item specifics...");
            specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
            setProgress(progressForStage("apply_core"));
          }

          // Specifics filling can clear the description, so restore just that.
          // Re-running the whole condition fill would reopen the picker modal.
          if (fillOptions.condition && listing.conditionDescription) {
            conditionResult = {
              ...conditionResult,
              conditionDescription: ensureConditionDescription(listing.conditionDescription),
            };
          }

          let descriptionResult = { description: false };
          if (fillOptions.description) {
            setStatusMessage("Updating item description...");
            descriptionResult = await fillEbayListingDescription(listing.description);
            setProgress(progressForStage("apply_core"));
          }

          let fitmentText = "Vehicle compatibility skipped";
          let applyWarnings: string[] = [];
          let appliedFitment = 0;
          if (fillOptions.fitment) {
            setStatusMessage(
              `Applying vehicle compatibility. Found ${listing.compatibility.length} compatible vehicle${listing.compatibility.length === 1 ? "" : "s"}.`,
            );
            const fitmentResult = await applyNormalizedFitment(listing.compatibility);
            appliedFitment = fitmentResult.filled;
            applyWarnings = fitmentResult.warnings;
            fitmentText = fitmentSummary(fitmentResult, listing.compatibility.length);
            if (fitmentResult.filled > 0) {
              setShowFitmentReload(true);
            }
          }

          await restoreListingPage();
          setProgress(progressForStage("complete"));

          const parts: string[] = [];
          parts.push(
            fillOptions.title
              ? filledTitle
                ? "Filled title"
                : "Could not fill the Title field"
              : "Title skipped",
          );
          parts.push(
            !fillOptions.price
              ? "price skipped"
              : priceResult.price
                ? `updated price (${listing.price})`
                : listing.price
                  ? `could not update price (${listing.price})`
                  : "no item price found",
          );
          parts.push(
            !fillOptions.images
              ? "Photos skipped"
              : listing.images.length === 0
                ? "No photos found"
                : filledImages === 0
                  ? `Found ${listing.images.length} photos, but the photo uploader was not on this page`
                  : `Added ${filledImages} photo${filledImages === 1 ? "" : "s"}`,
          );
          parts.push(
            !fillOptions.specifics
              ? "item specifics skipped"
              : listing.itemSpecifics.length === 0
                ? "no item specifics found"
                : `filled ${specResult.filled} of ${listing.itemSpecifics.length} item specifics`,
          );
          parts.push(
            !fillOptions.category
              ? "item category skipped"
              : categoryResult.itemCategory
                ? `updated item category (${listing.category.path.join(" > ") || listing.category.name})`
                : listing.category.path.length || listing.category.name
                  ? `could not update item category (${listing.category.path.join(" > ") || listing.category.name})`
                  : "no item category found",
          );
          parts.push(
            !fillOptions.condition
              ? "item condition skipped"
              : conditionResult.condition
                ? `updated item condition (${listing.condition})`
                : listing.condition
                  ? `could not update item condition (${listing.condition})`
                  : "no item condition found",
          );
          if (fillOptions.condition && listing.conditionDescription) {
            parts.push(
              conditionResult.conditionDescription
                ? "updated condition description"
                : "could not update condition description",
            );
          }
          parts.push(
            !fillOptions.description
              ? "description skipped"
              : descriptionResult.description
                ? "updated item description"
                : listing.description
                  ? "could not update item description"
                  : "no item description found",
          );
          parts.push(fitmentText);

          setStatusMessage(`${parts.join(". ")}.`);
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: appliedFitment,
            imageCount: filledImages,
            warningCount: applyWarnings.length,
            warnings: applyWarnings,
          });
          setIsComplete(true);
          return;
        }
        case "only-fitment": {
          setStatusMessage("Waiting for an available worker...");
          setProgress(progressForStage("queued"));
          setStatusMessage("Opening and validating the source eBay listing.");
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
            warningCount: fitmentResult.warnings.length,
            warnings: fitmentResult.warnings,
          });
          setIsComplete(true);
          return;
        }
        default: {
          const exhaustive: never = scrapeMode;
          throw new Error(`Unhandled scrape mode: ${String(exhaustive)}`);
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
        <FieldRow label="Scrape mode" htmlFor="scrape-mode">
          <div className="control-row">
            <ScrapeModeSelect
              id="scrape-mode"
              value={scrapeMode}
              disabled={isProcessing}
              onChange={handleScrapeModeChange}
            />
            {scrapeMode === "full-scrape" ? (
              <FillOptionsMenu
                value={fillOptions}
                disabled={isProcessing}
                onChange={setFillOptions}
              />
            ) : null}
          </div>
        </FieldRow>

        <FieldRow label="Source URL / ID" htmlFor="source-url">
          <div className="control-row">
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
            <button
              type="button"
              className="icon-button"
              onClick={handleClearCache}
              disabled={isProcessing || isClearingCache || source.trim().length === 0}
              title="Clear the cached scrape for this listing"
              aria-label="Clear the cached scrape for this listing"
            >
              <TrashIcon />
            </button>
          </div>
        </FieldRow>

        <div className="form-actions">
          {isComplete ? null : (
            <button
              type="button"
              className="clear-form-button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isProcessing || isClearingForm}
            >
              {isClearingForm ? "Clearing..." : "Clear form"}
            </button>
          )}
          <button className="process-button" type="submit" disabled={isProcessing}>
            <SparkleIcon />
            {isProcessing ? "Processing..." : "Process Listing"}
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
              Enter a source listing and process to fill this form
            </span>
          )}
        </p>
      </div>

      {showClearConfirm ? (
        <ConfirmDialog
          title="Clear the form?"
          message="Do you really want to clear the form? This empties the eBay listing fields this extension fills - title, photos, item specifics and vehicle compatibility. Your source URL / ID is kept, and item category and condition are left alone because eBay requires a value for both."
          confirmLabel="OK"
          onConfirm={() => {
            void clearForm();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      ) : null}
    </section>
  );
}
