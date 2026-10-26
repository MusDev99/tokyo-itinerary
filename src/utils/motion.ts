/** True when the viewer asked for less motion (always false during SSR). Check before every Motion `animate()`. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type Frames = Record<string, Array<string | number>>;
const TRANSFORM_KEYS = ['x', 'y', 'rotate', 'scale', 'scaleY'] as const;
const px = (v: string | number) => (typeof v === 'number' ? `${v}px` : v);
const parseUnit = (v: string | number) => {
  const m = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(String(v));
  return m ? { n: Number(m[1]), unit: m[2] } : null;
};
const deg = (v: string | number) => (typeof v === 'number' ? `${v}deg` : v);

/**
 * Folds Motion's independent transform keys (x, y, rotate, scale) into one `transform` keyframe list so the
 * animation runs on the compositor (Web Animations) instead of a per-frame JS loop on the main thread, which
 * kept taps and scrolling below 60fps. `base` keeps a static transform (e.g. a tilt) in every frame.
 */
export function compositorFrames(frames: Frames, base = ''): Frames {
  const keys = TRANSFORM_KEYS.filter((k) => frames[k]);
  if (!keys.length) return frames;
  const steps = Math.max(...keys.map((k) => frames[k].length));
  // Shorter lists are interpolated onto the longest one's timeline (same as Motion spreading keyframes evenly)
  const at = (k: (typeof TRANSFORM_KEYS)[number], i: number) => {
    const list = frames[k];
    const pos = (i * (list.length - 1)) / Math.max(1, steps - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(list.length - 1, lo + 1);
    if (pos === lo) return list[lo];
    const a = parseUnit(list[lo]);
    const b = parseUnit(list[hi]);
    if (!a || !b || a.unit !== b.unit) return list[Math.round(pos)];
    const v = +(a.n + (b.n - a.n) * (pos - lo)).toFixed(3);
    return typeof list[lo] === 'number' ? v : `${v}${a.unit}`;
  };
  const transform = Array.from({ length: steps }, (_, i) =>
    [
      base,
      frames.x || frames.y ? `translate(${px(frames.x ? at('x', i) : 0)}, ${px(frames.y ? at('y', i) : 0)})` : '',
      frames.rotate ? `rotate(${deg(at('rotate', i))})` : '',
      frames.scale ? `scale(${at('scale', i)})` : '',
      frames.scaleY ? `scaleY(${at('scaleY', i)})` : '',
    ]
      .filter(Boolean)
      .join(' ')
  );
  const rest: Frames = {};
  for (const [k, v] of Object.entries(frames)) if (!(TRANSFORM_KEYS as readonly string[]).includes(k)) rest[k] = v;
  return { ...rest, transform };
}
