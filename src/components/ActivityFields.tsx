import { h } from 'preact';
import { CATEGORIES, POPULAR_CURRENCIES } from '../utils/analytics';
import { inputClass } from './inputClass';
import AnalogTimePicker from './AnalogTimePicker';
import CalendarPicker from './CalendarPicker';
import FormField from './FormField';

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
  /** City of this place (only trips through several cities use it) */
  city: string;
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
  city: '',
});

export { inputClass };

interface Props {
  value: ActivityDraft;
  errors?: Record<string, string>;
  onChange: (patch: Partial<ActivityDraft>) => void;
  idPrefix: string;
  /** Hide the date field when the date is set by the surrounding day block */
  hideDate?: boolean;
  /** Only dates inside the trip can be picked (ISO, empty = unbounded) */
  dateMin?: string;
  dateMax?: string;
}

export default function ActivityFields({ value, errors = {}, onChange, idPrefix, hideDate, dateMin = '', dateMax = '' }: Props) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const cur = POPULAR_CURRENCIES.some((c) => c.code === value.price_currency) || !value.price_currency
    ? POPULAR_CURRENCIES
    : [{ code: value.price_currency, name: value.price_currency, symbol: '', flag: '' }, ...POPULAR_CURRENCIES];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
      {!hideDate && (
        <FormField label="Date" required error={errors.date} htmlFor={id('date')} className="sm:col-span-2">
          <CalendarPicker id={id('date')} value={value.date} invalid={!!errors.date} min={dateMin} max={dateMax}
            onChange={(date) => onChange({ date })} />
          {dateMin && dateMax && <span className="text-[11px] text-text/55">Trip days only</span>}
        </FormField>
      )}
      <FormField label="Time" error={errors.time} htmlFor={id('time')} className={hideDate ? 'sm:col-span-3' : 'sm:col-span-2'}>
        <AnalogTimePicker id={id('time')} value={value.time} invalid={!!errors.time}
          onChange={(time) => onChange({ time })} />
        {value.time && (
          <button type="button" onClick={() => onChange({ time: '' })}
            className="self-start px-1 py-1 text-[11px] font-bold text-primary hover:underline">
            Clear time (--:--)
          </button>
        )}
      </FormField>
      <FormField label="Category" htmlFor={id('category')} className={hideDate ? 'sm:col-span-3' : 'sm:col-span-2'}>
        <select id={id('category')} className={inputClass} value={value.category}
          onChange={(e) => onChange({ category: (e.target as HTMLSelectElement).value })}>
          <option value="">Auto-detect</option>
          {Object.values(CATEGORIES).map((c) => (
            <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Title" required error={errors.title} htmlFor={id('title')} className="sm:col-span-6">
        <input id={id('title')} type="text" maxLength={200} className={inputClass} placeholder="e.g. Senso-ji Temple visit"
          value={value.title} onInput={(e) => onChange({ title: (e.target as HTMLInputElement).value })} />
      </FormField>
      <FormField label="Description" htmlFor={id('description')} className="sm:col-span-6">
        <textarea id={id('description')} rows={2} maxLength={2000} className={inputClass}
          value={value.description} onInput={(e) => onChange({ description: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
      <FormField label="Location name" htmlFor={id('location')} className="sm:col-span-6">
        <input id={id('location')} type="text" maxLength={200} className={inputClass} placeholder="Used to build the Google Maps link"
          value={value.location_name} onInput={(e) => onChange({ location_name: (e.target as HTMLInputElement).value })} />
      </FormField>
      <FormField label="Amount" error={errors.price_amount} htmlFor={id('amount')} className="sm:col-span-2">
        <input id={id('amount')} type="number" inputMode="decimal" min="0" step="any" className={inputClass}
          value={value.price_amount} onInput={(e) => onChange({ price_amount: (e.target as HTMLInputElement).value })} />
      </FormField>
      <FormField label="Currency" error={errors.price_currency} htmlFor={id('currency')} className="sm:col-span-2">
        <select id={id('currency')} className={inputClass} value={value.price_currency}
          onChange={(e) => onChange({ price_currency: (e.target as HTMLSelectElement).value, currencyTouched: true })}>
          {cur.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Price notes" htmlFor={id('notes')} className="sm:col-span-2">
        <input id={id('notes')} type="text" maxLength={200} className={inputClass} placeholder="e.g. per person"
          value={value.price_notes} onInput={(e) => onChange({ price_notes: (e.target as HTMLInputElement).value })} />
      </FormField>
    </div>
  );
}

/**
 * The optional half of an activity (description, price). Shown behind a "More details"
 * disclosure in the quick Add place sheet (Hick's Law: only the essentials up front).
 */
export function MoreFields({ value, errors = {}, onChange, idPrefix }: Omit<Props, 'hideDate'>) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const cur = POPULAR_CURRENCIES.some((c) => c.code === value.price_currency) || !value.price_currency
    ? POPULAR_CURRENCIES
    : [{ code: value.price_currency, name: value.price_currency, symbol: '', flag: '' }, ...POPULAR_CURRENCIES];
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Description" htmlFor={id('description')} className="col-span-2">
        <textarea id={id('description')} rows={2} maxLength={2000} className={inputClass}
          value={value.description} onInput={(e) => onChange({ description: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
      <FormField label="Amount" error={errors.price_amount} htmlFor={id('amount')}>
        <input id={id('amount')} type="number" inputMode="decimal" min="0" step="any" className={inputClass}
          value={value.price_amount} onInput={(e) => onChange({ price_amount: (e.target as HTMLInputElement).value })} />
      </FormField>
      <FormField label="Currency" error={errors.price_currency} htmlFor={id('currency')}>
        <select id={id('currency')} className={inputClass} value={value.price_currency}
          onChange={(e) => onChange({ price_currency: (e.target as HTMLSelectElement).value, currencyTouched: true })}>
          {cur.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Price notes" htmlFor={id('notes')} className="col-span-2">
        <input id={id('notes')} type="text" maxLength={200} className={inputClass} placeholder="e.g. per person"
          value={value.price_notes} onInput={(e) => onChange({ price_notes: (e.target as HTMLInputElement).value })} />
      </FormField>
    </div>
  );
}

export function draftToPayload(d: ActivityDraft) {
  const { currencyTouched, ...rest } = d;
  return rest;
}
