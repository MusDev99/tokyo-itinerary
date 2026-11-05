/**
 * Runs `fn` on the first page load and again after every soft navigation (Astro's ClientRouter swaps the body
 * without re-running bundled scripts, and only fires `astro:page-load` when the router is on). Without the router
 * it simply runs once.
 */
export function onPageLoad(fn: () => void): void {
  if (document.querySelector('meta[name="astro-view-transitions-enabled"]')) {
    document.addEventListener('astro:page-load', fn);
  } else {
    fn();
  }
}
