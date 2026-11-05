import { navigate } from 'astro:transitions/client';

/** Re-fetches the current page in place (no white flash, scroll kept) after a write; a full reload if the router is off. */
export function refreshPage(): void {
  void navigate(location.pathname + location.search, { history: 'replace' });
}

/** Goes to another page the soft way (falls back to a normal navigation when the router is off). */
export function goTo(href: string): void {
  void navigate(href);
}
