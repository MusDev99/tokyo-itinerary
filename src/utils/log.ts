/**
 * Structured server logs (one JSON object per line, easy to filter in the host's log viewer) with secrets scrubbed.
 * `formatLog` / `redact` are pure and unit-tested; `log` writes them. A request id from the middleware is attached
 * automatically (AsyncLocalStorage), so every line of one request can be found from the id shown on the error page.
 * OWASP A09: never log passwords, tokens, keys, cookies or Authorization headers.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type Level = 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /(token|secret|passw(or)?d|authorization|cookie|api[-_]?key|private[-_]?key|credential|bearer|verifier|id_token|session)/i;
const MAX_STRING = 400;
const MAX_DEPTH = 4;

/** Scrubs secrets that can sit inside free text (error messages, response bodies). */
export function scrubText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[redacted-jwt]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[redacted-key]')
    .replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, '[redacted-long]')
    .replace(/([?&](?:access_token|id_token|code|key|token|client_secret)=)[^&\s"']+/gi, '$1[redacted]');
}

/** Copies a value for logging: sensitive keys hidden, text scrubbed and cut, depth and size bounded, cycles safe. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const clean = scrubText(value);
    return clean.length > MAX_STRING ? `${clean.slice(0, MAX_STRING)}…` : clean;
  }
  if (value instanceof Error) return { name: value.name, message: redact(value.message, depth + 1, seen) };
  if (typeof value !== 'object') return String(value);
  if (seen.has(value as object)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[…]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1, seen);
  }
  return out;
}

/** What to log about a thrown value: its kind and a scrubbed message, never the whole object. */
export function errorInfo(err: unknown): { errorName: string; errorMessage: string } {
  if (err instanceof Error) return { errorName: err.name, errorMessage: String(redact(err.message)) };
  return { errorName: typeof err, errorMessage: String(redact(String(err))) };
}

export function formatLog(level: Level, event: string, fields: Record<string, unknown> = {}, now = Date.now()): string {
  return JSON.stringify({ ts: new Date(now).toISOString(), level, event, ...(redact(fields) as object) });
}

const store = new AsyncLocalStorage<{ requestId: string }>();
export const runWithRequest = <T>(requestId: string, fn: () => T): T => store.run({ requestId }, fn);
export const currentRequestId = (): string | undefined => store.getStore()?.requestId;

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  const requestId = currentRequestId();
  const line = formatLog(level, event, requestId ? { requestId, ...fields } : fields);
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
};

/** A request id safe to echo in a header and show to a person: the host's id if sane, else a short random one. */
export function newRequestId(hostId?: string | null): string {
  const tail = (hostId || '').split('::').pop() || '';
  return /^[A-Za-z0-9-]{6,64}$/.test(tail) ? tail : crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
