// Pure helpers for long destination lists (header menu, phone drawer, home): search, A-Z groups, "show first N".

/** How many destinations show before "Show all": 8 is about what fits a phone drawer without scrolling. */
export const COLLAPSE_AFTER = 8;

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Case- and accent-insensitive match on the name or any extra text (e.g. its states). */
export function matchesQuery(query: string, ...texts: string[]): boolean {
  const q = fold(query);
  if (!q) return true;
  return texts.some((t) => fold(t).includes(q));
}

/** "A".."Z", or "#" for names that start with a digit or symbol. */
export function letterOf(name: string): string {
  const c = fold(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/** Consecutive A-Z sections of an already-sorted list; keeps the incoming order inside a section. */
export function groupByLetter<T>(items: readonly T[], nameOf: (item: T) => string): Array<{ letter: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => fold(nameOf(a)).localeCompare(fold(nameOf(b))))) {
    const l = letterOf(nameOf(it));
    groups.set(l, [...(groups.get(l) || []), it]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))).map(([letter, items]) => ({ letter, items }));
}

/**
 * What to render: a search shows every match; otherwise the first `limit` (the list arrives ordered by
 * relevance, e.g. ongoing trips first), or all of them after "Show all".
 */
export function visibleItems<T>(items: readonly T[], opts: { query: string; showAll: boolean; limit?: number; matches: (item: T, q: string) => boolean }): { shown: T[]; hidden: number } {
  const { query, showAll, limit = COLLAPSE_AFTER, matches } = opts;
  if (query.trim()) return { shown: items.filter((i) => matches(i, query)), hidden: 0 };
  if (showAll || items.length <= limit) return { shown: [...items], hidden: 0 };
  return { shown: items.slice(0, limit), hidden: items.length - limit };
}
