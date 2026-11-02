/** What a link click needs to know to decide whether it starts a page load (DOM-free so it can be unit-tested). */
export interface NavClick {
  /** The link's resolved `href` (`a.href`) */
  href: string;
  /** `target` attribute, if any */
  target?: string | null;
  /** True when the link has a `download` attribute */
  download?: boolean;
  /** Mouse button (0 = primary) */
  button?: number;
  /** Any of ctrl / meta / shift / alt held (new tab, new window, download) */
  modifier?: boolean;
  /** `event.defaultPrevented`: an island handled the click itself */
  handled?: boolean;
}

// Paths that never render a page here: API calls (/api/auth/google leaves for Google) and file downloads
const NOT_PAGES = ['/api/', '/_astro/'];

/**
 * True when a click leaves this page for another page on the same site, i.e. when the "loading" state should
 * show. False for new tabs, other sites, in-page anchors, downloads (.ics, .pdf) and API routes, which never
 * unload the page and would leave the loading bar stuck.
 */
export function startsPageLoad(click: NavClick, current: string): boolean {
  if (click.handled || click.download || (click.button ?? 0) !== 0 || click.modifier) return false;
  if (click.target && click.target !== '_self') return false;
  let to: URL;
  let from: URL;
  try {
    to = new URL(click.href, current);
    from = new URL(current);
  } catch {
    return false;
  }
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return false;
  if (to.origin !== from.origin) return false;
  // Same page, only the hash changes: the browser scrolls, nothing loads
  if (to.pathname === from.pathname && to.search === from.search && to.hash) return false;
  if (NOT_PAGES.some((p) => to.pathname.startsWith(p))) return false;
  // A file extension (calendar.ics, sitemap.xml) is a download or a raw file, not a page
  if (/\.[a-z0-9]+$/i.test(to.pathname)) return false;
  return true;
}
