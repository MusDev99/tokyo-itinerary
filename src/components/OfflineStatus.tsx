import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';

/** Registers the service worker (production only) and shows a pill while the device is offline. */
export default function OfflineStatus() {
  const [offline, setOffline] = useState(false);
  const pill = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // Dev stays SW-free so HMR and fresh server renders are never masked by a saved copy
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => navigator.onLine && reg.active?.postMessage({ type: 'warm' }))
        .catch((err) => console.error('[pwa] service worker registration failed', err));
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (offline && pill.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animate(pill.current, { opacity: [0, 1], y: [12, 0] }, { type: 'spring', stiffness: 380, damping: 28 });
    }
  }, [offline]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-5 left-4 z-40 pointer-events-none mobile-safe-area">
      {offline && (
        // Jakob's Law: familiar "you're offline" pill; Fitts's Law: 44px target in the thumb zone, clear of the header and theme switcher
        <a
          ref={pill}
          href="/offline"
          className="pointer-events-auto touch-target inline-flex items-center gap-2 h-11 px-4 rounded-full bg-surface-solid border border-primary/30 shadow-lg text-sm font-bold text-text whitespace-nowrap"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
          Offline · saved copy
        </a>
      )}
    </div>
  );
}
