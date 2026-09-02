export const PARSER_SELECTORS = {
  title: [
    'h1[data-testid="x-item-title-label"]',
    'h1[id="x-item-title-label"]',
    "h1.it-ttl",
    ".x-item-title-label",
    "#viTabs_0_is h1",
    'h1[class*="x-item-title"]',
    'h1[class*="it-ttl"]',
    "#ebay-item-title",
    'h1[class*="motors-title"]',
    "h1.x-item-title",
    "h1.x-item-title__mainTitle",
    'h1[itemprop="name"]',
  ],
};

export const EBAY_SELECTORS = {
  imageGrid: {
    image: ".ux-image-grid-item.image-treatment.rounded-edges img",
  },
};

export function extractImagesFromDocument(doc) {
  const imageSelector =
    EBAY_SELECTORS.imageGrid.image;
  const seenBase = new Map();

  const getBase = (url) =>
    url
      .replace(/\/s-l\d+\./g, "/")
      .replace(/\/s-l\d+$/g, "")
      .split("?")[0]
      .split("#")[0];

  const getImageId = (url) => {
    const gMatch = url.match(/\/g\/([^/?#]+)/i);
    if (gMatch?.[1]) return gMatch[1];
    const zMatch = url.match(/\/z\/([^/?#]+)/i);
    if (zMatch?.[1]) return zMatch[1];
    return getBase(url);
  };

  const getPriority = (url) => {
    if (url.includes("s-l1600") || url.includes("s-l1500")) return 4;
    if (url.includes("s-l500")) return 2;
    if (url.includes("s-l140")) return 1;
    return 0;
  };

  const pushImage = (src) => {
    if (!src) return;
    if (src.includes("placeholder") || src.startsWith("data:image")) return;
    const id = getImageId(src);
    const priority = getPriority(src);
    const existing = seenBase.get(id);
    if (!existing || priority > existing.priority) {
      seenBase.set(id, { url: src, priority });
    }
  };

  if (imageSelector) {
    doc.querySelectorAll(imageSelector).forEach((img) => {
      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src");
      pushImage(src);
    });
  }

  if (!seenBase.size) {
    doc
      .querySelectorAll(
        "#PicturePanel .ux-image-grid-item img, .x-photos-min-view img",
      )
      .forEach((img) => {
        const src =
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src");
        pushImage(src);
      });
  }

  return Array.from(seenBase.values()).map((entry) => entry.url);
}
