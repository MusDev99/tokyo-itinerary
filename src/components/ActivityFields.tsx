import { h } from 'preact';
import { CATEGORIES, POPULAR_CURRENCIES } from '../utils/analytics';
import { inputClass } from './inputClass';
import AnalogTimePicker from './AnalogTimePicker';

export interface ActivityDraft {
  date: string;
  title: string;
  time: string;
  description: string;
  category: string;
  location_name: string;
  price_amount: string;
  price_currency: string;
  price_notes: string;
  /** true once the user picks a currency themselves (stops auto-follow of the country currency) */
  currencyTouched?: boolean;
}

export const emptyActivity = (currency = ''): ActivityDraft => ({
  date: '',
  title: '',
  time: '',
  description: '',
  category: '',
  location_name: '',
  price_amount: '',
  price_currency: currency,
  price_notes: '',
});

export { inputClass };

interface Props {
  value: ActivityDraft;
  errors?: Record<string, string>;
  onChange: (patch: Partial<ActivityDraft>) => void;
  idPrefix: string;
}

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: any;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-bold text-text/80">
        {label}
        {required ? <span className="text-red-600"> *</span> : <span className="text-text/40 font-medium"> (optional)</span>}
      </label>
      {children}
      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </div>
  );
}

export default function ActivityFields({ value, errors = {}, onChange, idPrefix }: Props) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const cur = POPULAR_CURRENCIES.some((c) => c.code === value.price_currency) || !value.price_currency
    ? POPULAR_CURRENCIES
    : [{ code: value.price_currency, name: value.price_currency, symbol: '', flag: '' }, ...POPULAR_CURRENCIES];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
      <Field label="Date" required error={errors.date} htmlFor={id('date')} className="sm:col-span-2">
        <input id={id('date')} type="date" className={inputClass} value={value.date}
          onInput={(e) => onChange({ date: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Time" required error={errors.time} htmlFor={id('time')} className="sm:col-span-2">
        <AnalogTimePicker id={id('time')} value={value.time} invalid={!!errors.time}
          onChange={(time) => onChange({ time })} />
      </Field>
      <Field label="Category" htmlFor={id('category')} className="sm:col-span-2">
        <select id={id('category')} className={inputClass} value={value.category}
          onChange={(e) => onChange({ category: (e.target as HTMLSelectElement).value })}>
          <option value="">Auto-detect</option>
          {Object.values(CATEGORIES).map((c) => (
            <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title" required error={errors.title} htmlFor={id('title')} className="sm:col-span-6">
        <input id={id('title')} type="text" maxLength={200} className={inputClass} placeholder="e.g. Senso-ji Temple visit"
          value={value.title} onInput={(e) => onChange({ title: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Description" htmlFor={id('description')} className="sm:col-span-6">
        <textarea id={id('description')} rows={2} maxLength={2000} className={inputClass}
          value={value.description} onInput={(e) => onChange({ description: (e.target as HTMLTextAreaElement).value })} />
      </Field>
      <Field label="Location name" htmlFor={id('location')} className="sm:col-span-6">
        <input id={id('location')} type="text" maxLength={200} className={inputClass} placeholder="Used to build the Google Maps link"
          value={value.location_name} onInput={(e) => onChange({ location_name: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Amount" error={errors.price_amount} htmlFor={id('amount')} className="sm:col-span-2">
        <input id={id('amount')} type="number" inputMode="decimal" min="0" step="any" className={inputClass}
          value={value.price_amount} onInput={(e) => onChange({ price_amount: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Currency" error={errors.price_currency} htmlFor={id('currency')} className="sm:col-span-2">
        <select id={id('currency')} className={inputClass} value={value.price_currency}
          onChange={(e) => onChange({ price_currency: (e.target as HTMLSelectElement).value, currencyTouched: true })}>
          {cur.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </Field>
      <Field label="Price notes" htmlFor={id('notes')} className="sm:col-span-2">
        <input id={id('notes')} type="text" maxLength={200} className={inputClass} placeholder="e.g. per person"
          value={value.price_notes} onInput={(e) => onChange({ price_notes: (e.target as HTMLInputElement).value })} />
      </Field>
    </div>
  );
}

export function draftToPayload(d: ActivityDraft) {
  const { currencyTouched, ...rest } = d;
  return rest;
}
