import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import FormField from './FormField';
import { inputClass } from './inputClass';
import { prefersReducedMotion } from '../utils/motion';
import { dueStatus, parseSaved, progress, storageKey, type CheckGroup, type SavedChecklist } from '../utils/checklist';

interface Props {
  /** Sheet tab of the trip: ticks are saved per device under this trip */
  tab: string;
  groups: CheckGroup[];
  firstDate: string | null;
}

interface RowProps {
  id: string;
  label: string;
  hint?: string;
  badge?: string;
  checked: boolean;
  onToggle: (id: string, row: HTMLElement | null) => void;
  onRemove?: () => void;
}

/** One 44px+ row; the whole row is the tap target (Fitts's Law). Module-level so it keeps focus across renders. */
function Row({ id, label, hint, badge, checked, onToggle, onRemove }: RowProps) {
  const ref = useRef<HTMLLabelElement>(null);
  return (
    <li className="flex items-stretch gap-1">
      <label
        ref={ref}
        className={`touch-target flex-1 min-w-0 flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
          checked ? 'bg-primary/10 border-primary/25' : 'bg-white/45 border-primary/15 hover:border-primary/35'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(id, ref.current)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--color-primary)]"
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold break-words ${checked ? 'line-through text-text/50' : 'text-text'}`}>{label}</span>
          {hint && <span className="block text-xs text-text/60 mt-0.5">{hint}</span>}
        </span>
        {badge && !checked && <span className="shrink-0 self-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800">{badge}</span>}
      </label>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="touch-target shrink-0 w-11 rounded-xl text-text/50 hover:text-red-600 hover:bg-red-500/10"
        >
          ✕
        </button>
      )}
    </li>
  );
}

/** "Prepare" checklist: ticks and extra items live on this device only (no sign-in, works offline). */
export default function TripChecklist({ tab, groups, firstDate }: Props) {
  const key = storageKey(tab);
  const [saved, setSaved] = useState<SavedChecklist>({ done: [], custom: [] });
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const bar = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    try {
      setSaved(parseSaved(localStorage.getItem(key)));
    } catch {
      /* storage blocked: the list still works for this visit */
    }
    setLoaded(true);
  }, [key]);

  const save = (next: SavedChecklist) => {
    setSaved(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode: keep it for this page */
    }
  };

  const done = new Set(saved.done);
  const toggle = (id: string, row: HTMLElement | null) => {
    const on = !done.has(id);
    save({ ...saved, done: on ? [...saved.done, id] : saved.done.filter((d) => d !== id) });
    if (on && row && !prefersReducedMotion()) animate(row, { scale: [1, 0.97, 1] }, { duration: 0.22, ease: 'easeOut' });
  };

  const addCustom = (e: SubmitEvent) => {
    e.preventDefault();
    const label = draft.trim().slice(0, 120);
    if (!label) return;
    save({ ...saved, custom: [...saved.custom, { id: `custom-${Date.now().toString(36)}`, label }] });
    setDraft('');
  };
  const removeCustom = (id: string) =>
    save({ done: saved.done.filter((d) => d !== id), custom: saved.custom.filter((c) => c.id !== id) });

  const { done: ready, total } = progress(groups, saved);
  const pct = total ? Math.round((ready / total) * 100) : 0;

  // Goal-Gradient Effect: the bar fills as you get closer to "ready"
  useEffect(() => {
    if (!bar.current || !loaded) return;
    if (prefersReducedMotion()) bar.current.style.width = `${pct}%`;
    else animate(bar.current, { width: `${pct}%` }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
  }, [pct, loaded]);

  // "Do soon" first: items whose lead time is running out, across all groups (Serial Position Effect)
  const urgent = groups
    .flatMap((g) => g.items)
    .map((i) => ({ item: i, due: dueStatus(i, firstDate, now) }))
    .filter((x) => x.due && x.due.kind !== 'later' && !done.has(x.item.id))
    .sort((a, b) => a.due!.days - b.due!.days);
  // Miller's Law: only the 5 most urgent here; the rest keep their badge inside their group
  const URGENT_MAX = 5;

  const dueBadge = (days: number) => (days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d left`);

  return (
    <section aria-labelledby="prepare-title" className="glass-effect rounded-2xl border border-primary/20 shadow-md p-4 sm:p-6 space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="prepare-title" className="text-lg sm:text-xl font-extrabold text-text">Get ready for your trip</h2>
          <span className="text-sm font-extrabold text-primary tabular-nums" aria-live="polite">
            {ready}/{total} ready
          </span>
        </div>
        <div className="h-2 rounded-full bg-primary/15 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Checklist progress">
          <div ref={bar} className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: '0%' }} />
        </div>
        <p className="text-xs text-text/60">Built from this trip's dates, places and activities. Your ticks are saved on this device.</p>
      </div>

      {urgent.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <h3 className="text-sm font-extrabold text-amber-900">⏰ Do these soon</h3>
          <ul className="space-y-2">
            {urgent.slice(0, URGENT_MAX).map(({ item, due }) => (
              <Row key={`u-${item.id}`} checked={false} onToggle={toggle} id={item.id} label={item.label} hint={item.hint} badge={dueBadge(due!.days)} />
            ))}
          </ul>
          {urgent.length > URGENT_MAX && (
            <p className="text-xs font-semibold text-amber-900/80">+{urgent.length - URGENT_MAX} more marked in the groups below</p>
          )}
        </div>
      )}

      {/* Progressive disclosure (Hick's Law): groups collapse; the first ones start open */}
      {groups.map((g, gi) => {
        const left = g.items.filter((i) => !done.has(i.id)).length;
        return (
          <details key={g.id} open={gi < 2} className="group rounded-xl">
            <summary className="touch-target list-none cursor-pointer flex items-center justify-between gap-3 py-2 select-none">
              <span className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-text">
                <span aria-hidden="true">{g.icon}</span>
                {g.label}
              </span>
              <span className="flex items-center gap-2 text-xs font-bold text-text/60">
                {left === 0 ? '✅ Done' : `${left} left`}
                <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <ul className="space-y-2 mt-1">
              {g.items.map((i) => {
                const due = dueStatus(i, firstDate, now);
                return <Row key={i.id} checked={done.has(i.id)} onToggle={toggle} id={i.id} label={i.label} hint={i.hint} badge={due && due.kind !== 'later' ? dueBadge(due.days) : undefined} />;
              })}
            </ul>
          </details>
        );
      })}

      <div className="space-y-2 pt-2 border-t border-primary/15">
        <h3 className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-text">
          <span aria-hidden="true">📝</span>
          My items
        </h3>
        {saved.custom.length > 0 && (
          <ul className="space-y-2">
            {saved.custom.map((c) => (
              <Row key={c.id} checked={done.has(c.id)} onToggle={toggle} id={c.id} label={c.label} onRemove={() => removeCustom(c.id)} />
            ))}
          </ul>
        )}
        <form onSubmit={addCustom} className="flex items-end gap-2">
          <FormField label="Add your own item" htmlFor="checklist-new" hideOptional className="flex-1">
            <input
              id="checklist-new"
              type="text"
              maxLength={120}
              value={draft}
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              placeholder="e.g. Buy omiyage for the office"
              className={inputClass}
            />
          </FormField>
          <button type="submit" disabled={!draft.trim()} className="touch-target shrink-0 h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40">
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
