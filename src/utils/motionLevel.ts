// How much the season background animates. Pure (no imports): unit-tested.
//   full = today's scenes (capped blur and star counts)
//   lite = gradient + a handful of slow particles, no blur or glow layers (default on phones / weak devices)
//   off  = static gradient (reduced motion, or the person's choice)

export type MotionLevel = 'full' | 'lite' | 'off';
export const MOTION_LEVELS: readonly MotionLevel[] = ['full', 'lite', 'off'];
export const isMotionLevel = (v: unknown): v is MotionLevel => MOTION_LEVELS.includes(v as MotionLevel);

export interface DeviceHints {
  saved?: string | null;
  reducedMotion?: boolean;
  coarsePointer?: boolean;
  width?: number;
  saveData?: boolean;
  deviceMemory?: number;
  cores?: number;
}

/** Reduced motion always wins; then the person's saved choice; else a default from the device. */
export function resolveMotionLevel(h: DeviceHints): MotionLevel {
  if (h.reducedMotion) return 'off';
  if (isMotionLevel(h.saved)) return h.saved;
  const weak = (h.deviceMemory ?? 8) <= 4 || (h.cores ?? 8) <= 4;
  if (h.saveData || h.coarsePointer || (h.width ?? 1024) < 768 || weak) return 'lite';
  return 'full';
}

/** Particles per effect: lite keeps a few, full is capped so the busiest scenes (night, rain) stay cheap. */
export function particleCount(base: number, density: number, level: MotionLevel): number {
  if (level === 'off') return 0;
  if (level === 'lite') return Math.min(6, Math.max(3, Math.round(base * 0.12)));
  return Math.max(4, Math.round(Math.min(base, 56) * density));
}

/** Blur radius: none in lite, at most 24px in full (40px blurs cost the most fill rate). */
export function blurPx(px: number, level: MotionLevel): number {
  return level === 'lite' || level === 'off' ? 0 : Math.min(px, 24);
}

/** Device facts from the browser; kept out of the pure resolver so it stays testable. */
export function readDeviceHints(saved: string | null): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    saved,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}
