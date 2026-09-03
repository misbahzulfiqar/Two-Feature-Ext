import { useState, type ChangeEvent, type FormEvent } from "react";
import { fillEbayListingCategories } from "../lib/fill-ebay-categories.ts";
import { fillEbayListingImages } from "../lib/fill-ebay-images.ts";
import { fillEbayListingSpecifics } from "../lib/fill-ebay-specifics.ts";
import { fillEbayListingTitle } from "../lib/fill-ebay-title.ts";
import { scrapeSourceListing } from "../lib/scrape-source-title.ts";
import { ControlField } from "./ControlField.tsx";
import { FieldRow } from "./FieldRow.tsx";
import { SparkleIcon } from "./Icons.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import { ScrapeModeSelect } from "./ScrapeModeSelect.tsx";
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
          setStatusMessage("Fetching listing title, images, and specs...");
          setProgress(28);
          const listing = await scrapeSourceListing(source);
          setProgress(55);

          if (!listing.title) {
            setProgress(100);
            setStatusMessage("Could not find a title on that listing");
            return;
          }

          setStatusMessage("Filling Title field...");
          const filledTitle = fillEbayListingTitle(listing.title);
          setProgress(78);

          if (!filledTitle) {
            setProgress(100);
            setStatusMessage("Found title, but the Title field was not on this page");
            return;
          }

          setStatusMessage("Adding photos...");
          const filledImages = await fillEbayListingImages(listing.images);
          setProgress(84);

          setStatusMessage("Updating item category and store category...");
          const categoryResult = await fillEbayListingCategories(
            listing.category,
            listing.storeCategories,
          );
          setProgress(92);

          setStatusMessage("Replacing item specifics...");
          const specResult = await fillEbayListingSpecifics(listing.itemSpecifics);
          setProgress(100);

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
            ? "updated item category"
            : listing.category.name
              ? "could not update item category"
              : "no item category found";
          const storeParts: string[] = [];
          if (categoryResult.storeCategory) {
            storeParts.push("store category added");
          } else if (listing.storeCategories[0]?.name) {
            storeParts.push("could not add store category");
          } else {
            storeParts.push("no store category found");
          }
          if (categoryResult.secondStoreCategory) {
            storeParts.push("second store category added");
          } else if (listing.storeCategories[1]?.name) {
            storeParts.push("could not add second store category");
          }
          const storeSummary = storeParts.join(". ");

          setStatusMessage(
            `Filled title. ${photoSummary}. ${specSummary}. ${categorySummary}. ${storeSummary}.`,
          );
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
        error instanceof Error ? error.message : "Could not scrape listing",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section className="assistant" aria-label="Sell Similar Assistant">
      <form className="assistant-form" onSubmit={handleSubmit}>
        <FieldRow label="Scrape mode" htmlFor="scrape-mode">
          <ScrapeModeSelect
            id="scrape-mode"
            value={scrapeMode}
            onChange={handleScrapeModeChange}
          />
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
