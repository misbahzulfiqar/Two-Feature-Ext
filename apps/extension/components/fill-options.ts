/**
 * Everything a full scrape can copy from the source listing into the editor.
 * The user can switch individual steps off; all are on by default.
 */
export const FILL_OPTIONS = [
  { id: "title", label: "Title" },
  { id: "price", label: "Price" },
  { id: "images", label: "Photos" },
  { id: "category", label: "Item category" },
  { id: "condition", label: "Condition" },
  { id: "specifics", label: "Item specifics" },
  { id: "description", label: "Description" },
  { id: "fitment", label: "Vehicle compatibility" },
] as const;

export type FillOptionId = (typeof FILL_OPTIONS)[number]["id"];

export type FillOptions = Record<FillOptionId, boolean>;

export const DEFAULT_FILL_OPTIONS: FillOptions = {
  title: true,
  price: true,
  images: true,
  category: true,
  condition: true,
  specifics: true,
  description: true,
  fitment: true,
};

export function countEnabled(options: FillOptions): number {
  return FILL_OPTIONS.filter((option) => options[option.id]).length;
}

export function allEnabled(options: FillOptions): boolean {
  return countEnabled(options) === FILL_OPTIONS.length;
}
