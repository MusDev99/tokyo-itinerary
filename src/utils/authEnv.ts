import { readAuthConfig, type AuthConfig } from './auth';

/**
 * Auth settings from the server environment. `npm run dev` exposes `.env` through import.meta.env (not process.env),
 * production hosts use process.env, so read both.
 */
export function authConfig(): AuthConfig {
  const meta = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
  return readAuthConfig({ ...meta, ...process.env });
}
