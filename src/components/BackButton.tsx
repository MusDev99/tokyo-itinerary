import { goTo } from '../utils/refresh';
import { backTarget, hasSiteHistory } from '../utils/backTarget';
import { h } from 'preact';
import { animate } from 'motion';
import { prefersReducedMotion } from '../utils/motion';

interface Props {
  /** Current pathname; used to find a sensible parent when there is no in-site history */
  path: string;
  /** Trip slug -> its country page (or "/"), so a trip never goes "up" to a page that does not exist */
  tripParents?: Record<string, string>;
}

/**
 * Universal back button (Jakob's Law: where users expect it, top-left; Fitts's Law: 44px target).
 * Goes back in history when the previous page is on this site, otherwise up one level.
 */
export default function BackButton({ path, tripParents = {} }: Props) {
  if (path === '/' || path === '') return null;

  const goBack = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!prefersReducedMotion()) {
      animate(el, { x: [0, -4, 0] }, { duration: 0.25 });
    }
    // Back to the previous page when we came from one on this site; otherwise up to the page this one belongs to
    if (hasSiteHistory(window.history.state, document.referrer, window.location.origin, window.history.length)) {
      window.history.back();
    } else {
      goTo(backTarget(window.location.pathname, tripParents));
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      title="Go back"
      className="touch-target inline-flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-text hover:bg-primary/10 active:bg-primary/15 focus-ring shrink-0"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
