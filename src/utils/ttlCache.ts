// Tiny time-boxed memo cache (no imports: unit-tested). Used for lookups that are slow and rarely change.

export interface TtlCache<V> {
  /** Cached value, or undefined when missing/expired */
  get(key: string, now?: number): V | undefined;
  set(key: string, value: V, now?: number): void;
  size(): number;
}

export function createTtlCache<V>(ttlMs: number, maxEntries = 200): TtlCache<V> {
  const map = new Map<string, { at: number; value: V }>();
  return {
    get(key, now = Date.now()) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (now - hit.at >= ttlMs) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value, now = Date.now()) {
      if (map.size >= maxEntries) map.delete(map.keys().next().value as string); // oldest first
      map.set(key, { at: now, value });
    },
    size: () => map.size,
  };
}
