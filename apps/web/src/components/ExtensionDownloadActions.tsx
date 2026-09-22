import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GradientButton, SecondaryButton } from "./Buttons";
import {
  fetchExtensionRelease,
  formatBuildDate,
  formatBytes,
  startExtensionDownload,
  type ExtensionRelease,
} from "../lib/extension-release";

/**
 * Replaces the old Chrome Web Store install button.
 *
 * The extension is self-hosted, so the flow is: download the zip, unzip it, and
 * load it unpacked. Chrome cannot install an extension from a link outside the
 * Web Store, so the install guide is not optional - it is linked from here.
 */
export function ExtensionDownloadActions({
  onCheck,
  align = "center",
}: {
  onCheck: () => void;
  align?: "center" | "start";
}) {
  const [release, setRelease] = useState<ExtensionRelease | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchExtensionRelease()
      .then((data) => {
        if (active) {
          setRelease(data);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load the extension build.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const rowClass =
    align === "start" ? "flex flex-wrap gap-2" : "flex flex-wrap justify-center gap-2";
  const textClass = align === "start" ? "text-sm text-mute" : "text-sm text-mute text-center";

  return (
    <div className="space-y-3">
      {error ? <p className={textClass}>{error}</p> : null}

      <div className={rowClass}>
        <GradientButton disabled={loading || Boolean(error)} onClick={startExtensionDownload}>
          {loading ? "Checking for build..." : "Download extension"}
        </GradientButton>
        <SecondaryButton onClick={onCheck}>Check Again</SecondaryButton>
      </div>

      {release ? (
        <p className={textClass}>
          Version {release.version} · {formatBytes(release.sizeBytes)} · built{" "}
          {formatBuildDate(release.builtAt)}
        </p>
      ) : null}

      <p className={textClass}>
        Chrome cannot install this straight from a link. After downloading, follow the{" "}
        <Link className="text-ink underline" to="/install">
          installation guide
        </Link>
        — it takes about a minute.
      </p>
    </div>
  );
}
