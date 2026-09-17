import { GradientButton, SecondaryButton } from "./Buttons";
import {
  configuredExtensionId,
  hasChromeStoreListing,
  openChromeStoreInstall,
} from "../lib/chrome-store";

export function ChromeStoreInstallActions({
  onCheck,
  installLabel = "Install from Chrome Web Store",
  align = "center",
}: {
  onCheck: () => void;
  installLabel?: string;
  align?: "center" | "start";
}) {
  const listingReady = hasChromeStoreListing();
  const extensionId = configuredExtensionId();
  const rowClass = align === "start" ? "flex flex-wrap gap-2" : "flex flex-wrap justify-center gap-2";
  return (
    <div className="space-y-3">
      {!listingReady ? (
        <p className="text-sm text-mute">
          The public Chrome Web Store listing is not linked yet. After Chrome publishes it, Install
          opens Add to Chrome for everyone. Until then, Check Again still works if the extension is
          already installed.
        </p>
      ) : null}
      {listingReady && !extensionId ? (
        <p className="text-sm text-mute">
          The store page is set, but this site cannot detect the installed extension until the
          listing URL includes the 32-character ID.
        </p>
      ) : null}
      <div className={rowClass}>
        <GradientButton
          disabled={!listingReady}
          onClick={() => {
            openChromeStoreInstall();
          }}
        >
          {installLabel}
        </GradientButton>
        <SecondaryButton onClick={onCheck}>Check Again</SecondaryButton>
      </div>
    </div>
  );
}
