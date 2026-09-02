export const EBAY_SELECTORS = {
  imageGrid: {
    image: ".ux-image-grid-item.image-treatment.rounded-edges img",
  },
};

function toAbsoluteUrl(src: string, baseUri: string): string {
  try {
    return new URL(src, baseUri).href;
  } catch {
    return src;
  }
}

function getBase(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  const withoutHash = withoutQuery.split("#")[0] ?? withoutQuery;
  return withoutHash.replace(/\/s-l\d+\./g, "/").replace(/\/s-l\d+$/g, "");
}

function getImageId(url: string): string {
  const gMatch = url.match(/\/g\/([^/?#]+)/i);
  if (gMatch?.[1]) {
    return gMatch[1];
  }
  const zMatch = url.match(/\/z\/([^/?#]+)/i);
  if (zMatch?.[1]) {
    return zMatch[1];
  }
  return getBase(url);
}

function getPriority(url: string): number {
  if (url.includes("s-l1600") || url.includes("s-l1500")) return 4;
  if (url.includes("s-l500")) return 2;
  if (url.includes("s-l140")) return 1;
  return 0;
}

function toHighRes(url: string): string {
  return url
    .replace(/\/s-l\d+(?=\.)/g, "/s-l1600")
    .replace(/\/s-l\d+$/g, "/s-l1600");
}

function collectImgSrc(img: Element): string[] {
  const values = [
    img.getAttribute("src"),
    img.getAttribute("data-src"),
    img.getAttribute("data-zoom-src"),
    img.getAttribute("data-lazy-src"),
  ];
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
  if (srcset) {
    for (const part of srcset.split(",")) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) {
        values.push(candidate);
      }
    }
  }
  return values.filter((value): value is string => Boolean(value));
}

function collectLdImages(doc: Document): string[] {
  const urls: string[] = [];
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of ldScripts) {
    const raw = script.textContent || "";
    if (!raw.trim()) continue;

    try {
      const data: unknown = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as { image?: unknown; ["@type"]?: unknown };
        const type = record["@type"];
        const isProduct =
          type === "Product" ||
          (Array.isArray(type) && type.includes("Product"));
        if (!isProduct || record.image === undefined) continue;

        const images = Array.isArray(record.image) ? record.image : [record.image];
        for (const image of images) {
          if (typeof image === "string") {
            urls.push(image);
            continue;
          }
          if (image && typeof image === "object" && "url" in image) {
            const url = (image as { url?: unknown }).url;
            if (typeof url === "string") {
              urls.push(url);
            }
          }
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  return urls;
}

export function extractListingImagesFromDocument(doc: Document): string[] {
  const seenBase = new Map<string, { url: string; priority: number }>();
  const baseUri = doc.baseURI || "https://www.ebay.com";

  const pushImage = (src: string | null | undefined): void => {
    if (!src) return;
    if (src.includes("placeholder") || src.startsWith("data:image")) return;

    const absolute = toAbsoluteUrl(src, baseUri);
    if (!/^https?:\/\//i.test(absolute)) return;

    const id = getImageId(absolute);
    const priority = getPriority(absolute);
    const existing = seenBase.get(id);
    if (!existing || priority > existing.priority) {
      seenBase.set(id, { url: absolute, priority });
    }
  };

  const collectFromSelector = (selector: string): void => {
    doc.querySelectorAll(selector).forEach((img) => {
      for (const src of collectImgSrc(img)) {
        pushImage(src);
      }
    });
  };

  collectFromSelector(EBAY_SELECTORS.imageGrid.image);

  if (!seenBase.size) {
    collectFromSelector(
      "#PicturePanel .ux-image-grid-item img, .x-photos-min-view img, .ux-image-carousel img",
    );
  }

  if (!seenBase.size) {
    for (const src of collectLdImages(doc)) {
      pushImage(src);
    }
  }

  if (!seenBase.size) {
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage instanceof HTMLMetaElement) {
      pushImage(ogImage.content);
    }
  }

  const urls = Array.from(seenBase.values()).map((entry) => toHighRes(entry.url));
  const first = urls[0];
  const last = urls[urls.length - 1];
  if (urls.length > 1 && first && last && getImageId(first) === getImageId(last)) {
    urls.pop();
  }
  return urls;
}
