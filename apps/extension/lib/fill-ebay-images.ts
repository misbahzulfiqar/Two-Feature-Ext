const PHOTO_INPUT_SELECTORS = [
  '.summary__photos input[type="file"]',
  '.uploader-module input[type="file"]',
  'input[type="file"][accept*="image"]',
  'input[type="file"]',
] as const;

const PHOTO_DROPZONE_SELECTORS = [
  "#uploader-ui-dropzone",
  ".file-dropzone-container",
  ".file-dropzone",
  ".summary__photos",
] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function findPhotoInput(): HTMLInputElement | null {
  for (const selector of PHOTO_INPUT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLInputElement) {
      return el;
    }
  }
  return null;
}

function findPhotoDropzone(): Element | null {
  for (const selector of PHOTO_DROPZONE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) {
      return el;
    }
  }
  return null;
}

function photoRoot(): ParentNode {
  return (
    document.querySelector(".summary__photos") ??
    document.querySelector(".uploader-thumbnails-ux") ??
    document
  );
}

function existingPhotoDeleteButtons(): HTMLButtonElement[] {
  return Array.from(
    photoRoot().querySelectorAll(
      'button[aria-label^="Delete photo"], button.icon-delete[aria-label*="Delete photo"]',
    ),
  ).filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
}

async function confirmPhotoDeleteIfNeeded(): Promise<void> {
  const dialog = document.querySelector(
    '.lightbox-dialog:not([hidden]) button.btn--primary, [role="dialog"]:not([hidden]) button.btn--primary',
  );
  if (dialog instanceof HTMLButtonElement) {
    dialog.click();
    await wait(80);
  }
}

async function removeExistingPhotos(): Promise<void> {
  for (let guard = 0; guard < 30; guard += 1) {
    const buttons = existingPhotoDeleteButtons();
    const last = buttons[buttons.length - 1];
    if (!last) {
      break;
    }
    last.click();
    await confirmPhotoDeleteIfNeeded();
    await wait(90);
  }
  await wait(150);
}

function fileNameFromUrl(url: string, index: number): string {
  try {
    const name = new URL(url).pathname.split("/").pop();
    if (name && /\.(jpe?g|png|webp|gif)$/i.test(name)) {
      return name;
    }
  } catch {
    // use fallback name
  }
  return `ebay-image-${index + 1}.jpg`;
}

async function fetchImageFile(url: string, index: number): Promise<File | null> {
  try {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (blob.size < 32) {
      return null;
    }
    const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    return new File([blob], fileNameFromUrl(url, index), { type });
  } catch {
    return null;
  }
}

function imageKey(url: string): string {
  const gMatch = url.match(/\/g\/([^/?#]+)/i);
  if (gMatch?.[1]) {
    return gMatch[1];
  }
  const zMatch = url.match(/\/z\/([^/?#]+)/i);
  if (zMatch?.[1]) {
    return zMatch[1];
  }
  return url.replace(/\/s-l\d+/g, "").split("?")[0] ?? url;
}

function uniqueImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const key = imageKey(url);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(url);
  }
  const first = unique[0];
  const last = unique[unique.length - 1];
  if (unique.length > 1 && first && last && imageKey(first) === imageKey(last)) {
    unique.pop();
  }
  return unique.slice(0, 24);
}

export async function fillEbayListingImages(urls: string[]): Promise<number> {
  const uniqueUrls = uniqueImageUrls(urls);
  if (uniqueUrls.length === 0) {
    return 0;
  }

  await removeExistingPhotos();

  const files: File[] = [];
  for (const [index, url] of uniqueUrls.entries()) {
    const file = await fetchImageFile(url, index);
    if (file) {
      files.push(file);
    }
  }
  if (files.length === 0) {
    return 0;
  }

  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }

  const input = findPhotoInput();
  if (input) {
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return files.length;
  }

  const dropzone = findPhotoDropzone();
  if (dropzone) {
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
    return files.length;
  }

  return 0;
}
