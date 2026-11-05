// One place for "a sheet/dialog/drawer is open": locks page scroll and tells the background to pause.
// Several overlays can stack; the lock is released when the last one closes.
let depth = 0;
let prevOverflow = '';

/** Call when an overlay opens; call the returned function when it closes. */
export function lockOverlay(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (depth === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.setAttribute('data-overlay', '');
  }
  depth++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      document.body.style.overflow = prevOverflow;
      document.documentElement.removeAttribute('data-overlay');
    }
  };
}
