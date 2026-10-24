import { h } from 'preact';
import { redirectIfSignedOut } from '../utils/authClient';
import { useState, useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import type { TimelineItem as TimelineItemType } from '../types/itinerary';
import { CATEGORIES, detectCategory } from '../utils/analytics';
import ConfirmDialog from './ConfirmDialog';
import ActivityFields, { draftToPayload, type ActivityDraft } from './ActivityFields';

interface TimelineItemProps extends TimelineItemType {
  isLast?: boolean;
}

export default function TimelineItem(props: TimelineItemProps) {
  const { id, tab, row, date, time, title, description, location, price, note, images, youtubeUrl, isLast } = props;
  const [showVideo, setShowVideo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const canEdit = Boolean(tab && (id || row));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);

  // Overflow ("⋯") menu: close on outside tap / Escape, small spring-in (Motion)
  useEffect(() => {
    if (!menuOpen) return;
    const down = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    if (menuPanel.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animate(menuPanel.current, { opacity: [0, 1], scale: [0.92, 1], y: [-6, 0] }, { type: 'spring', stiffness: 420, damping: 28 });
    }
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [menuOpen]);
  // Addresses the row by id, or by sheet row + original title for legacy rows without an id
  const rowRef = id ? { id } : { row, expectTitle: title };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const startEdit = () => {
    setDraft({
      date: date || '',
      title,
      time,
      description: description || '',
      category: props.category || '',
      location_name: location?.name === title ? '' : location?.name || '',
      price_amount: price?.amount ? String(price.amount) : '',
      price_currency: price?.currency || '',
      price_notes: price?.notes || '',
    });
    setFieldErrors({});
    setActionError('');
    setEditing(true);
  };

  const callApi = async (method: 'PATCH' | 'DELETE', body: unknown) => {
    setBusy(true);
    setActionError('');
    try {
      const res = await fetch('/api/itinerary', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Something went wrong');
        setFieldErrors(data.rowErrors?.[0] || {});
        return;
      }
      window.location.reload();
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = () => draft && callApi('PATCH', { tab, ...rowRef, activity: draftToPayload(draft) });
  const remove = () => callApi('DELETE', { tab, ...rowRef });

  const categoryMeta = detectCategory(props);

  const formatPrice = (p: TimelineItemType['price']) => {
    if (!p || p.amount === 0) return 'Free';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: p.currency || 'USD',
        maximumFractionDigits: p.amount % 1 === 0 ? 0 : 2,
      }).format(p.amount);
    } catch {
      return `${p.amount.toLocaleString()} ${p.currency}`;
    }
  };

  return (
    <div className="relative pl-5 sm:pl-10 group">
      {/* Timeline Node & Vertical Connector */}
      <div
        className="absolute left-0.5 sm:left-2 top-5 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-primary ring-4 ring-white shadow-sm z-10"
        aria-hidden="true"
      />
      {!isLast && (
        <div
          className="absolute left-[7px] sm:left-[13px] top-8 -bottom-5 w-0.5 bg-primary/25"
          aria-hidden="true"
        />
      )}

      {/* Activity Card (Law of Common Region & Law of Proximity: Keep Time, Category, Price & Location scannable together) */}
      <article className="bg-white/45 hover:bg-white/60 rounded-2xl border border-primary/15 hover:border-primary/35 shadow-sm transition-colors duration-150 p-3.5 sm:p-5">
        {/* Row 1: when (left) and cost + actions (right). Fewer, aligned elements = faster scanning (Miller's Law, Law of Proximity) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-primary tabular-nums">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {time}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                price.amount > 0
                  ? 'bg-amber-500/15 text-amber-900 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/25'
              }`}
            >
              {formatPrice(price)}
            </span>

            {canEdit && !editing && (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Actions for ${title}`}
                  className="touch-target inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-text/70 hover:bg-primary/10 active:bg-primary/15 text-xl leading-none"
                >
                  <span aria-hidden="true">⋯</span>
                </button>
                {menuOpen && (
                  <div
                    ref={menuPanel}
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl bg-surface-solid border border-primary/20 shadow-xl p-1"
                  >
                    <button type="button" role="menuitem"
                      onClick={() => { setMenuOpen(false); startEdit(); }}
                      className="touch-target w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-text hover:bg-primary/10 text-left">
                      <span aria-hidden="true">✏️</span> Edit
                    </button>
                    <button type="button" role="menuitem"
                      onClick={() => { setMenuOpen(false); setActionError(''); setConfirmOpen(true); }}
                      className="touch-target w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-500/10 text-left">
                      <span aria-hidden="true">🗑️</span> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category as a quiet overline above the title instead of a boxed chip */}
        <div
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1"
          style={{ color: categoryMeta.color }}
        >
          <span aria-hidden="true">{categoryMeta.emoji}</span>
          <span>{categoryMeta.label}</span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base sm:text-lg font-extrabold text-text mb-1 leading-snug">{title}</h3>
        {description && (
          <p className="text-sm text-text/75 leading-relaxed mb-3">{description}</p>
        )}
        {price.notes && (
          <p className="text-xs text-text/60 -mt-1.5 mb-3">💬 {price.notes}</p>
        )}

        {/* Optional Activity Image */}
        {images && (
          <div className="relative mb-3.5 overflow-hidden rounded-xl border border-primary/15 bg-primary/5">
            {!imageLoaded && (
              <div className="h-44 sm:h-48 w-full animate-pulse bg-primary/10 rounded-xl" />
            )}
            <img
              src={images}
              alt={title}
              className={`w-full max-h-60 object-cover transition-opacity duration-200 ${
                imageLoaded ? 'opacity-100' : 'opacity-0 h-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        )}

        {/* Travel Note / Tip: lightweight, no heavy box */}
        {note && (
          <div className="flex items-start gap-2 pl-3 py-0.5 mb-3 border-l-2 border-amber-500/60 text-xs sm:text-sm text-text/80">
            <span aria-hidden="true">💡</span>
            <p className="leading-relaxed"><span className="font-bold text-text">Tip: </span>{note}</p>
          </div>
        )}

        {/* Actions: one full-width, 44px primary target; secondary below (Fitts's Law, Hick's Law) */}
        {(location?.name || youtubeUrl) && (
          <div className="grid gap-2 pt-3 border-t border-primary/10">
            {location?.name && (
              <a
                href={location.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="touch-target flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary hover:text-white active:bg-primary active:text-white text-primary text-sm font-bold transition-colors min-w-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{location.name}</span>
                </span>
                <span className="text-xs font-semibold opacity-80 shrink-0">Open map ↗</span>
              </a>
            )}

            {youtubeUrl && (
              <button
                type="button"
                onClick={() => setShowVideo(!showVideo)}
                aria-expanded={showVideo}
                className="touch-target flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-600 active:bg-red-600 text-red-700 hover:text-white active:text-white text-sm font-bold transition-colors"
              >
                <span aria-hidden="true">▶</span>
                <span>{showVideo ? 'Hide video guide' : 'Watch video guide'}</span>
              </button>
            )}
          </div>
        )}

        {editing && draft && (
          <div className="mt-3 pt-3 border-t border-primary/10 space-y-3">
            <ActivityFields
              idPrefix={`edit-${id || row}`}
              value={draft}
              errors={fieldErrors}
              onChange={(patch) => setDraft({ ...draft, ...patch })}
            />
            {actionError && (
              <div role="alert" className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-800">
                {actionError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => setEditing(false)} disabled={busy}
                className="touch-target px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold">
                Cancel
              </button>
              <button type="button" onClick={saveEdit} disabled={busy}
                className="touch-target px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
        {!editing && actionError && (
          <div role="alert" className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-800">
            {actionError}
          </div>
        )}

        {/* Progressive Disclosure for Video Embed (Hick's Law) */}
        {youtubeUrl && showVideo && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <iframe
              src={youtubeUrl}
              title={`${title} video guide`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full aspect-video rounded-xl shadow-sm"
            />
          </div>
        )}
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this activity?"
        message={<>“{title}” will be permanently removed from the Google Sheet. This can't be undone.</>}
        confirmLabel="Delete activity"
        busy={busy}
        error={confirmOpen ? actionError : ''}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}