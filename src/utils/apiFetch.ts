/**
 * One way to call our own JSON API from the browser: same headers, same timeout, same error text everywhere
 * (replaces ~12 hand-rolled fetch/try/catch blocks). Never throws: callers branch on `ok`.
 * Only the server's `error` string is shown (it is already a UserError message), never raw exceptions (OWASP A05).
 */
export const NETWORK_ERROR = 'Network error. Please try again.';
export const TIMEOUT_ERROR = 'This is taking too long. Please try again.';
export const GENERIC_ERROR = 'Something went wrong';

export type ApiFailKind = 'network' | 'timeout' | 'signed-out' | 'http';

export interface ApiOk<T> { ok: true; status: number; data: T }
export interface ApiFail { ok: false; status: number; kind: ApiFailKind; error: string; data: any }
export type ApiResult<T = any> = ApiOk<T> | ApiFail;

export interface ApiOptions {
  method?: string;
  /** Sent as JSON */
  body?: unknown;
  signal?: AbortSignal;
  /** Default 25 s */
  timeoutMs?: number;
  /** Called on 401/503 (signed out, or editing disabled); the default sends the browser to /login */
  onSignedOut?: () => void;
}

function toLogin(): void {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(here)}`;
}

export async function apiFetch<T = any>(
  url: string,
  opts: ApiOptions = {},
  fetchImpl: typeof fetch = (...a) => fetch(...a)
): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? 25000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(url, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    if (res.status === 401 || res.status === 503) {
      (opts.onSignedOut ?? toLogin)();
      return { ok: false, status: res.status, kind: 'signed-out', error: 'Please sign in again.', data };
    }
    const msg = typeof data?.error === 'string' && data.error ? data.error : GENERIC_ERROR;
    return { ok: false, status: res.status, kind: 'http', error: msg, data };
  } catch (e: any) {
    // A caller-initiated abort (a newer search replaced this one) is not an error to show
    if (!timedOut && opts.signal?.aborted) return { ok: false, status: 0, kind: 'network', error: '', data: null };
    return { ok: false, status: 0, kind: timedOut ? 'timeout' : 'network', error: timedOut ? TIMEOUT_ERROR : NETWORK_ERROR, data: null };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
