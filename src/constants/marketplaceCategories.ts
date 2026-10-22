export const NOTE_CATEGORY_LABEL = 'Ders Notları / PDF';
export const NOTE_CATEGORY_VALUE = 'notes';
export const BOOK_CATEGORY_LABEL = 'Kitap';
export const BOOK_CATEGORY_VALUE = 'books';
export const GOODS_CATEGORY_LABEL = 'İkinci El Eşya';
export const GOODS_CATEGORY_VALUE = 'goods';
export const ELECTRONICS_CATEGORY_LABEL = 'Elektronik';
export const ELECTRONICS_CATEGORY_VALUE = 'electronics';

export const MARKETPLACE_CATEGORIES = [
  BOOK_CATEGORY_LABEL,
  GOODS_CATEGORY_LABEL,
  ELECTRONICS_CATEGORY_LABEL,
  'Ev & Yurt',
  'Giyim',
  NOTE_CATEGORY_LABEL,
  'Diğer',
];

const CATEGORY_VALUES: Record<string, readonly string[]> = {
  [BOOK_CATEGORY_LABEL]: ['books', 'kitap'],
  [GOODS_CATEGORY_LABEL]: ['goods', 'ikinci el eşya'],
  [ELECTRONICS_CATEGORY_LABEL]: ['electronics', 'elektronik'],
  [NOTE_CATEGORY_LABEL]: ['notes', 'pdf', 'ders notları / pdf'],
};

const STORED_CATEGORY_VALUES: Record<string, string> = {
  [BOOK_CATEGORY_LABEL]: BOOK_CATEGORY_VALUE,
  [GOODS_CATEGORY_LABEL]: GOODS_CATEGORY_VALUE,
  [ELECTRONICS_CATEGORY_LABEL]: ELECTRONICS_CATEGORY_VALUE,
  [NOTE_CATEGORY_LABEL]: NOTE_CATEGORY_VALUE,
};

function normalizeCategory(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function getStoredMarketplaceCategory(label: string): string {
  return STORED_CATEGORY_VALUES[label] ?? label;
}

export function matchesMarketplaceCategory(value: string, label: string): boolean {
  const acceptedValues = CATEGORY_VALUES[label];
  return acceptedValues
    ? acceptedValues.includes(normalizeCategory(value))
    : normalizeCategory(value) === normalizeCategory(label);
}

export function isNoteMarketplaceCategory(value: string): boolean {
  return matchesMarketplaceCategory(value, NOTE_CATEGORY_LABEL);
}

export function getMarketplaceCategoryLabel(value: string): string {
  const matchingLabel = Object.keys(CATEGORY_VALUES).find((label) => matchesMarketplaceCategory(value, label));
  if (matchingLabel) return matchingLabel;
  return value;
}
