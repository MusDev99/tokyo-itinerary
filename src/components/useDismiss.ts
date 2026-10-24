import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export type DismissReason = 'outside' | 'escape';

/**
 * While `open`, calls `onDismiss` on a pointer press outside every element in `inside`, or on Escape.
 * The latest `onDismiss` is always used, so callers can pass an inline function.
 */
export function useDismiss(open: boolean, inside: RefObject<Element>[], onDismiss: (reason: DismissReason) => void) {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!inside.some((r) => r.current?.contains(t))) cb.current('outside');
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && cb.current('escape');
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
}
