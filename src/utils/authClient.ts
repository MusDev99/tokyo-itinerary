/** Browser helper: a 401 from a write API means the editor session expired, so send the person to sign in and back. */
export function redirectIfSignedOut(res: Response): boolean {
  if (res.status !== 401 && res.status !== 503) return false;
  const here = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(here)}`;
  return true;
}
