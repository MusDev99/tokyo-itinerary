/** True when the viewer asked for less motion (always false during SSR). Check before every Motion `animate()`. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
