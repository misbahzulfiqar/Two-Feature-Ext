import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ListingCategory, ScrapeProgressStage, VehicleCompatibility } from "@sell-similar/contracts";
import {
  captureFitmentTargetEditor,
  fillEbayListingFitment,
  type FillFitmentResult,
} from "../lib/fill-ebay-fitment.ts";
import { fillEbayListingCategories } from "../lib/fill-ebay-category.ts";
import { clearEbayListingImages, fillEbayListingImages } from "../lib/fill-ebay-images.ts";
import { fillEbayListingSpecifics } from "../lib/fill-ebay-specifics.ts";
import { fitmentLog } from "../lib/fitment-debug.ts";
import { progressForStage } from "../lib/scrape-progress.ts";
import { FITMENT_PAGE_PROGRESS } from "../lib/scrape-messages.ts";
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
  { id: "specs-and-fitment", label: "Full scrape" },
  { id: "fitment-only", label: "Fitment only" },
  { id: "specs-only", label: "Specs only" },
  { id: "images", label: "Images" },
] as const;

const FILL_FIELDS = [
  { id: "title", label: "Title" },
  { id: "photos", label: "Photos" },
  { id: "category", label: "Item category" },
  { id: "specifics", label: "Item specifics" },
  { id: "fitment", label: "Vehicle compatibility" },
] as const;

type FillMode = (typeof FILL_MODES)[number]["id"];
type FillFieldId = (typeof FILL_FIELDS)[number]["id"];
type FillFieldSelection = Record<FillFieldId, boolean>;

function allFillFields(selected: boolean): FillFieldSelection {
  return {
    title: selected,
    photos: selected,
    category: selected,
    specifics: selected,
    fitment: selected,
  };
}

function imageStatus(sourceCount: number, filled: number): string {
  if (sourceCount === 0) {
    return "No photos found";
  }
  if (filled === 0) {
    return `Found ${sourceCount} photos, but the photo uploader was not on this page`;
  }
  return `Added ${filled} photo${filled === 1 ? "" : "s"}`;
}

export function SellSimilarAssistant() {
  const [fillMode, setFillMode] = useState<FillMode>("specs-and-fitment");
  const [fillMenuOpen, setFillMenuOpen] = useState(false);
  const [fields, setFields] = useState<FillFieldSelection>(allFillFields(true));
  const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false);
  const fillMenuId = useId();
  const fieldsMenuId = useId();
  const [source, setSource] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showFitmentReload, setShowFitmentReload] = useState(false);
  const logRef = useRef<HTMLUListElement | null>(null);
  const appendStatusRef = useRef<(message: string) => void>(() => undefined);

  function appendStatus(message: string): void {
    const text = message.trim();
    if (!text) {
      return;
    }
    setStatusMessage(text);
    setStatusLines((current) =>
      current[current.length - 1] === text ? current : [...current, text].slice(-20),
    );
  }
  appendStatusRef.current = appendStatus;

  useEffect(() => {
    const show = (message: string): void => {
      appendStatusRef.current(message);
    };
    const onWindowProgress = (event: Event): void => {
      const detail = (event as CustomEvent<{ page?: number; vehicles?: number; message?: string }>).detail;
      if (typeof detail?.message === "string" && detail.message.trim()) {
        show(detail.message);
        return;
      }
      const page = Number(detail?.page);
      const vehicles = Number(detail?.vehicles);
      if (!Number.isFinite(page) || !Number.isFinite(vehicles) || page < 1) {
        return;
      }
      show(`Scraped page ${page} — ${vehicles} vehicles found so far`);
    };
    const onRuntimeProgress = (message: unknown): void => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        message.type !== FITMENT_PAGE_PROGRESS
      ) {
        return;
      }
      if ("message" in message && typeof message.message === "string" && message.message.trim()) {
        console.log(`[SellSimilar][fitment-pages] ${message.message}`);
        show(message.message);
        return;
      }
      const page = "page" in message ? Number(message.page) : 0;
      const vehicles = "vehicles" in message ? Number(message.vehicles) : 0;
      if (!Number.isFinite(page) || !Number.isFinite(vehicles) || page < 1) {
        return;
      }
      show(`Scraped page ${page} — ${vehicles} vehicles found so far`);
    };
    window.addEventListener("sell-similar-fitment-progress", onWindowProgress);
    browser.runtime.onMessage.addListener(onRuntimeProgress);
    return () => {
      window.removeEventListener("sell-similar-fitment-progress", onWindowProgress);
      browser.runtime.onMessage.removeListener(onRuntimeProgress);
    };
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [statusLines]);

  const rootRef = useRef<HTMLElement | null>(null);
  const isBusy = isProcessing;

  function selectFillMode(mode: FillMode): void {
    setFillMode(mode);
    setFillMenuOpen(false);
  }

  function toggleFillField(id: FillFieldId, selected: boolean): void {
    setFields((current) => ({ ...current, [id]: selected }));
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
    if (result.sectionFound && result.skipped === 0 && result.filled > 0) {
      const saved = result.filled;
      return `Fitment saved: ${saved} vehicle${saved === 1 ? "" : "s"}`;
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
          appendStatus(message);
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

  async function applySelectedCategory(category: ListingCategory): Promise<void> {
    if (!fields.category) {
      appendStatus("Item category skipped");
      return;
    }
    const label = category.path.filter((part) => part.trim()).join(" > ") || category.name.trim();
    if (!category.name.trim() && !category.id.trim()) {
      appendStatus("No item category found");
      return;
    }
    appendStatus("Updating item category...");
    const result = await fillEbayListingCategories(category);
    appendStatus(
      result.itemCategory
        ? `Updated item category: ${label || category.id}`
        : "Could not update item category",
    );
  }

  async function applySelectedImages(urls: string[]): Promise<number> {
    if (!fields.photos) {
      return 0;
    }
    appendStatus("Adding photos...");
    const filled = await fillEbayListingImages(urls);
    appendStatus(imageStatus(urls.length, filled));
    return filled;
  }

  async function clearFilledListingFields(): Promise<void> {
    if (isProcessing) {
      return;
    }
    if (!fields.photos && fillMode !== "images") {
      appendStatus("No fields selected to clear.");
      return;
    }
    try {
      const cleared = await clearEbayListingImages();
      appendStatus(`Photos: ${cleared}`);
    } catch (error) {
      appendStatus(error instanceof Error ? `Photos failed. ${error.message}` : "Photos failed.");
    }
  }

  async function applyNormalizedFitment(rows: VehicleCompatibility[]): Promise<FillFitmentResult> {
    if (rows.length === 0) {
      appendStatus("FITMENT_EMPTY. Existing target fitment left unchanged.");
      advanceProgress("normalize");
      return fillEbayListingFitment(rows);
    }

    advanceProgress("normalize");
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
    setStatusLines([]);
    const scrollBefore = captureListingScroll();
    captureFitmentTargetEditor();
    fitmentLog("1 Process Listing clicked", `mode=${fillMode}`);

    try {
      switch (fillMode) {
        case "specs-and-fitment": {
          console.log("[SellSimilar] specs and fitment clicked");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape", { fitmentPages: true }),
          );
          console.log("[SellSimilar] scrape ready", {
            specifics: listing.itemSpecifics.length,
            fitment: listing.compatibility.length,
          });
          setProgress(progressForStage("listing_extract"));
          setProgress(progressForStage("target_prepare"));
          const filledImages = await applySelectedImages(listing.images);
          await applySelectedCategory(listing.category);
          let specFilled = 0;
          if (fields.specifics) {
            console.log("[SellSimilar] filling item specifics", listing.itemSpecifics.length);
            appendStatus("Replacing item specifics...");
            const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
            specFilled = specResult.filled;
          }
          setProgress(progressForStage("apply_core"));

          const fitmentResult = fields.fitment
            ? await applyNormalizedFitment(listing.compatibility)
            : undefined;
          if (fitmentResult && fitmentResult.filled > 0) {
            setShowFitmentReload(true);
          }

          await restoreListingPage();
          setProgress(progressForStage("complete"));
          const specificsText = !fields.specifics
            ? ""
            : listing.itemSpecifics.length === 0
              ? "No item specifics found"
              : `Filled ${specFilled} of ${listing.itemSpecifics.length} item specifics`;
          const fitmentText = fitmentResult
            ? fitmentSummary(fitmentResult, listing.compatibility.length)
            : "";
          appendStatus(`${fitmentText} ${specificsText}`.trim());
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: fitmentResult?.filled ?? 0,
            imageCount: filledImages,
            warningCount: fitmentResult?.warnings.length ?? 0,
            warnings: fitmentResult?.warnings ?? [],
          });
          setIsComplete(true);
          break;
        }
        case "specs-only": {
          console.log("[SellSimilar] specs only clicked");
          appendStatus("Reading item specifics...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape", { fitmentPages: false }),
          );
          setProgress(progressForStage("listing_extract"));

          setProgress(progressForStage("target_prepare"));
          const filledImages = await applySelectedImages(listing.images);
          let specFilled = 0;
          if (fields.specifics) {
            console.log("[SellSimilar] filling item specifics", listing.itemSpecifics.length);
            appendStatus("Replacing item specifics...");
            const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
            specFilled = specResult.filled;
          }
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          if (fields.specifics) {
            appendStatus(
              listing.itemSpecifics.length === 0
                ? "No item specifics found."
                : `Filled ${specFilled} of ${listing.itemSpecifics.length} item specifics.`,
            );
          }
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: 0,
            imageCount: filledImages,
            warningCount: 0,
            warnings: [],
          });
          setIsComplete(true);
          break;
        }
        case "images": {
          console.log("[SellSimilar] images clicked");
          appendStatus("Reading photos...");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, "full-scrape", { fitmentPages: false }),
          );
          setProgress(progressForStage("listing_extract"));
          setProgress(progressForStage("target_prepare"));
          const filledImages = await applySelectedImages(listing.images);
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: 0,
            imageCount: filledImages,
            warningCount: 0,
            warnings: [],
          });
          setIsComplete(true);
          break;
        }
        case "fitment-only": {
          console.log("[SellSimilar] fitment only clicked");
          setProgress(progressForStage("source_load"));
          const listing = await withLiveScrapeStatus(() =>
            scrapeSourceListing(source, fields.photos ? "full-scrape" : "only-fitment", {
              fitmentPages: true,
            }),
          );
          setProgress(progressForStage("fitment_extract"));
          const filledImages = await applySelectedImages(listing.images);
          const fitmentResult = fields.fitment
            ? await applyNormalizedFitment(listing.compatibility)
            : undefined;
          await restoreListingPage();
          setProgress(progressForStage("complete"));
          if (fitmentResult) {
            appendStatus(fitmentSummary(fitmentResult, listing.compatibility.length));
            if (fitmentResult.filled > 0) {
              setShowFitmentReload(true);
            }
          }
          await reportApplyResult({
            jobId: listing.jobId,
            fitmentCount: fitmentResult?.filled ?? 0,
            imageCount: filledImages,
            warningCount: fitmentResult?.warnings.length ?? 0,
            warnings: fitmentResult?.warnings ?? [],
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
      console.log(
        "[SellSimilar] scrape failed",
        error instanceof Error ? error.message : error,
      );
      setProgress(0);
      setIsComplete(false);
      appendStatus(error instanceof Error ? error.message : "Could not scrape listing");
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
              onClick={() => {
                setFillMenuOpen((open) => !open);
                setFieldsMenuOpen(false);
              }}
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

        <FieldRow label="Fields" htmlFor="fill-fields">
          <div className={fieldsMenuOpen ? "options-menu is-open" : "options-menu"}>
            <button
              type="button"
              id="fill-fields"
              className="mode-dropdown-trigger"
              disabled={isProcessing}
              aria-haspopup="dialog"
              aria-expanded={fieldsMenuOpen}
              aria-controls={fieldsMenuId}
              onClick={() => {
                setFieldsMenuOpen((open) => !open);
                setFillMenuOpen(false);
              }}
            >
              <span className="mode-dropdown-value">Fill these fields</span>
              <span className="chevron" aria-hidden="true">
                <ChevronIcon />
              </span>
            </button>
            {fieldsMenuOpen ? (
              <>
                <div
                  className="options-backdrop"
                  onClick={() => setFieldsMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="options-popover" id={fieldsMenuId} role="dialog" aria-label="Fill these fields">
                  <div className="options-popover-head">
                    <span>Fill these fields</span>
                    <div className="options-popover-actions">
                      <button type="button" onClick={() => setFields(allFillFields(true))}>
                        All
                      </button>
                      <button type="button" onClick={() => setFields(allFillFields(false))}>
                        None
                      </button>
                    </div>
                  </div>
                  {FILL_FIELDS.map((field) => (
                    <label key={field.id} className="options-item">
                      <input
                        type="checkbox"
                        checked={fields[field.id]}
                        onChange={(event) => toggleFillField(field.id, event.target.checked)}
                      />
                      <span className="options-item-label">{field.label}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </FieldRow>

        <div className="form-actions">
          <button
            className="clear-form-button"
            type="button"
            disabled={isProcessing}
            onClick={() => {
              void clearFilledListingFields();
            }}
          >
            Clear form
          </button>
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
        {statusLines.length > 0 ? (
          <ul className="activity-log" ref={logRef}>
            {statusLines.map((line, index) => (
              <li key={`${index}-${line}`} className={index === statusLines.length - 1 ? "is-latest" : undefined}>
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="activity-copy">
            <span className="activity-status activity-status--idle">
              {statusMessage || "Choose what to fill, then scrape and fill"}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
