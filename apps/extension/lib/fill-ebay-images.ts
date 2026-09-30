const MAX_UPLOAD_IMAGES = 24;
const MIN_IMAGE_BYTES = 32;
const MAX_DELETE_ATTEMPTS = 30;
const DELETE_PAUSE_MS = 250;

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)(?:$|[?#])/i;

const PHOTO_ROOT_SELECTORS = [
  ".summary__photos",
  "[inflow*='photo' i]",
  "[data-testid*='photo' i]",
  ".uploader",
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function imageIdentity(url: string): string {
  const gallery = url.match(/\/g\/([^/?#]+)/i)?.[1];
  if (gallery) {
    return `g:${gallery}`;
  }
  const zoom = url.match(/\/z\/([^/?#]+)/i)?.[1];
  if (zoom) {
    return `z:${zoom}`;
  }
  const withoutSuffix = url.split("#")[0]?.split("?")[0] ?? url;
  return withoutSuffix.replace(/s-l\d+/gi, "");
}

export function uniqueImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) {
      continue;
    }
    const identity = imageIdentity(url);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    unique.push(url);
  }
  if (
    unique.length > 1 &&
    imageIdentity(unique[0] ?? "") === imageIdentity(unique[unique.length - 1] ?? "")
  ) {
    unique.pop();
  }
  return unique.slice(0, MAX_UPLOAD_IMAGES);
}

function photoRoot(): ParentNode | undefined {
  for (const selector of PHOTO_ROOT_SELECTORS) {
    const match = document.querySelector(selector);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function elementLabel(element: Element): string {
  const aria = element.getAttribute("aria-label") ?? "";
  const title = element.getAttribute("title") ?? "";
  const text = element.textContent ?? "";
  return `${aria} ${title} ${text}`.replace(/\s+/g, " ").trim();
}

function isPhotoDeleteButton(element: Element): boolean {
  if (!(element instanceof HTMLButtonElement) && element.getAttribute("role") !== "button") {
    return false;
  }
  if (!isVisible(element)) {
    return false;
  }
  const label = elementLabel(element);
  const className = typeof element.className === "string" ? element.className : "";
  if (/delete|remove/i.test(label) && /photo|image|picture|thumbnail/i.test(label)) {
    return true;
  }
  if (/^(delete|remove|remove photo|delete photo)$/i.test(label)) {
    return true;
  }
  return /delete|remove/i.test(className) && /photo|image|thumb|uploader/i.test(className);
}

function photoDeleteButtons(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll("button, [role='button']")].filter(
    (element): element is HTMLElement => isPhotoDeleteButton(element),
  );
}

function confirmVisibleDeleteDialog(): void {
  const dialogs = document.querySelectorAll("[role='dialog'], [role='alertdialog'], .lightbox-dialog");
  for (const dialog of dialogs) {
    if (!isVisible(dialog)) {
      continue;
    }
    const confirm = [...dialog.querySelectorAll("button")].find((button) =>
      /delete|remove|yes|confirm/i.test(elementLabel(button)),
    );
    confirm?.click();
  }
}

async function removeExistingPhotos(): Promise<number> {
  const root = photoRoot();
  if (!root) {
    return 0;
  }
  let clicks = 0;
  for (let attempt = 0; attempt < MAX_DELETE_ATTEMPTS; attempt += 1) {
    const buttons = photoDeleteButtons(root);
    const last = buttons[buttons.length - 1];
    if (!last) {
      break;
    }
    last.click();
    clicks += 1;
    confirmVisibleDeleteDialog();
    await wait(DELETE_PAUSE_MS);
  }
  return clicks;
}

function filenameFromUrl(url: string, index: number): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    if (IMAGE_EXTENSION.test(name)) {
      return name;
    }
  } catch {
    // Fall through to a generated name.
  }
  return `photo-${index + 1}.jpg`;
}

async function fetchImageFile(url: string, index: number): Promise<File | undefined> {
  try {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      return undefined;
    }
    const blob = await response.blob();
    if (blob.size < MIN_IMAGE_BYTES) {
      return undefined;
    }
    const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    return new File([blob], filenameFromUrl(url, index), { type });
  } catch {
    return undefined;
  }
}

function supportedPhotoInput(root: ParentNode): HTMLInputElement | undefined {
  const inputs = [...root.querySelectorAll("input[type='file']")];
  return inputs.find((input): input is HTMLInputElement => {
    if (!(input instanceof HTMLInputElement) || input.disabled) {
      return false;
    }
    const accept = input.accept.trim().toLowerCase();
    return accept === "" || accept.includes("image");
  });
}

function supportedDropZone(root: ParentNode): HTMLElement | undefined {
  if (
    root instanceof HTMLElement &&
    root.matches(".uploader, .uploader-dropzone, .dropzone, [class*='drop-zone' i], [class*='dropzone' i]")
  ) {
    return root;
  }
  const zone = root.querySelector(
    "[data-testid*='drop' i], .uploader-dropzone, .dropzone, [class*='drop-zone' i], [class*='dropzone' i], .uploader",
  );
  return zone instanceof HTMLElement ? zone : undefined;
}

function filesToTransfer(files: File[]): DataTransfer {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return transfer;
}

function submitPhotoFiles(files: File[]): number {
  const root = photoRoot();
  if (!root) {
    return 0;
  }
  const transfer = filesToTransfer(files);
  const input = supportedPhotoInput(root);
  if (input) {
    try {
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return files.length;
    } catch {
      // Some editors reject a programmatic file list; try the drop zone next.
    }
  }

  const zone = supportedDropZone(root);
  if (!zone) {
    return 0;
  }
  try {
    const drop = new DragEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: transfer });
    zone.dispatchEvent(drop);
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * Download source image URLs and submit them to the target listing photo
 * uploader. Returns how many files were dispatched, not how many eBay stored.
 */
export async function fillEbayListingImages(urls: string[]): Promise<number> {
  const unique = uniqueImageUrls(urls);
  if (unique.length === 0) {
    return 0;
  }

  await removeExistingPhotos();

  const files: File[] = [];
  for (let index = 0; index < unique.length; index += 1) {
    const url = unique[index];
    if (!url) {
      continue;
    }
    const file = await fetchImageFile(url, index);
    if (file) {
      files.push(file);
    }
  }
  if (files.length === 0) {
    return 0;
  }
  return submitPhotoFiles(files);
}

/** Remove target listing photos. Returns how many delete controls were clicked. */
export async function clearEbayListingImages(): Promise<number> {
  return removeExistingPhotos();
}
