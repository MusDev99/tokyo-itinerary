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
 * the viewport; flips above the trigger when there is no room below.
 */
export function anchorPosition(anchor: AnchorRect, pop: Size, viewport: Size, gap = 8, margin = 8): { top: number; left: number } {
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - pop.width - margin));
  let top = anchor.bottom + gap;
  if (top + pop.height > viewport.height) top = Math.max(margin, anchor.top - pop.height - gap);
  return { top, left };
}
