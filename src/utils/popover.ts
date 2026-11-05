export interface Size {
  width: number;
  height: number;
}

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
}

/**
 * Places a fixed-position popover under its trigger, left-aligned and kept `margin` px inside
 * the viewport; flips above the trigger when there is no room below. When it fits on neither side
 * (a tall picker on a short phone screen) it is centred in the viewport instead of being pinned to the top,
 * where it would sit on top of the field that opened it: `centered: true` tells the caller to dim the page.
 */
export function anchorPosition(
  anchor: AnchorRect,
  pop: Size,
  viewport: Size,
  gap = 8,
  margin = 8
): { top: number; left: number; centered?: true } {
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - pop.width - margin));
  const below = anchor.bottom + gap;
  if (below + pop.height <= viewport.height - margin) return { top: below, left };
  const above = anchor.top - pop.height - gap;
  if (above >= margin) return { top: above, left };
  return { top: Math.max(margin, Math.round((viewport.height - pop.height) / 2)), left, centered: true };
}
