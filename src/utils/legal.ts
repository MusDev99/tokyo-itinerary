/**
 * Settings for the privacy notice and terms (pure, unit-tested). The text itself lives in the two pages; what changes
 * per business (company name, contact, governing law) comes from public environment variables, so nothing about a
 * specific company is hard-coded and nothing is claimed that has not been configured.
 */

/** Bump when the text of either page changes in substance (shown as "Last updated"). */
export const LEGAL_UPDATED = '2026-11-07';

export interface LegalConfig {
  /** Who operates this PlanTravel (default "PlanTravel") */
  company: string;
  /** Contact email, or '' */
  email: string;
  /** Admin WhatsApp number (digits), or '' */
  whatsapp: string;
  /** e.g. "Malaysia"; the governing-law clause is shown only when set */
  governingLaw: string;
  /** true once a lawyer has reviewed the text: hides the draft notice */
  reviewed: boolean;
}

const clean = (v: unknown, max: number): string =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function legalConfig(env: Record<string, string | undefined>): LegalConfig {
  const email = clean(env.PUBLIC_CONTACT_EMAIL, 120);
  const digits = String(env.ADMIN_WHATSAPP ?? '').replace(/\D/g, '');
  return {
    company: clean(env.PUBLIC_COMPANY_NAME, 80) || 'PlanTravel',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    whatsapp: digits.length >= 8 && digits.length <= 15 ? digits : '',
    governingLaw: clean(env.PUBLIC_GOVERNING_LAW, 60),
    reviewed: env.PUBLIC_LEGAL_REVIEWED === '1',
  };
}

/** Ways to reach the operator, best first. */
export function contactLinks(cfg: LegalConfig): Array<{ label: string; href: string }> {
  const out: Array<{ label: string; href: string }> = [];
  if (cfg.email) out.push({ label: cfg.email, href: `mailto:${cfg.email}` });
  if (cfg.whatsapp) out.push({ label: `WhatsApp +${cfg.whatsapp}`, href: `https://wa.me/${cfg.whatsapp}` });
  return out;
}
