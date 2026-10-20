import { h } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { inputClass } from './inputClass';

interface Props {
  id: string;
  value: string; // "HH:MM" (24h) or ""
  onChange: (value: string) => void;
  invalid?: boolean;
}

const SIZE = 232;
const C = SIZE / 2;
const R_NUM = 88;
const R_HAND = 74;
const pad = (n: number) => String(n).padStart(2, '0');

/** Accepts "HH:MM", "H:MM AM/PM"; returns 24h parts or null. */
function parse(v: string): { h: number; m: number } | null {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3]) {
    const pm = m[3].toLowerCase() === 'pm';
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

export function formatTime12(v: string): string {
  const p = parse(v);
  if (!p) return '';
  const h12 = p.h % 12 || 12;
  return `${pad(h12)}:${pad(p.m)} ${p.h >= 12 ? 'PM' : 'AM'}`;
}

const polar = (angleDeg: number, r: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

export default function AnalogTimePicker({ id, value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [h12, setH12] = useState(12);
  const [min, setMin] = useState(0);
  const [pm, setPm] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const openPicker = () => {
    const p = parse(value) || { h: 9, m: 0 };
    setH12(p.h % 12 || 12);
    setMin(p.m);
    setPm(p.h >= 12);
    setMode('hour');
    const r = trigger.current!.getBoundingClientRect();
    const width = 272;
    const height = 430;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    let top = r.bottom + 8;
    if (top + height > window.innerHeight) top = Math.max(8, r.top - height - 8);
    setPos({ top, left });
    setOpen(true);
  };

  // Entrance animation (Motion; skipped for reduced motion)
  useEffect(() => {
    if (!open || !pop.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(pop.current, { opacity: [0, 1], scale: [0.94, 1], y: [-6, 0] }, { type: 'spring', stiffness: 380, damping: 26 });
  }, [open]);

  // Close on outside press / Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const pick = (e: PointerEvent, finish: boolean) => {
    const svg = dial.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const scale = SIZE / r.width;
    const x = (e.clientX - r.left) * scale - C;
    const y = (e.clientY - r.top) * scale - C;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    if (mode === 'hour') {
      const hv = Math.round(deg / 30) % 12 || 12;
      setH12(hv);
      if (finish) setMode('minute');
    } else {
      setMin(Math.round(deg / 6) % 60);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    if (mode === 'hour') setH12(((h12 - 1 + dir + 12) % 12) + 1);
    else setMin((min + dir + 60) % 60);
  };

  const commit = () => {
    const h24 = (h12 % 12) + (pm ? 12 : 0);
    onChange(`${pad(h24)}:${pad(min)}`);
    setOpen(false);
    trigger.current?.focus();
  };

  const handAngle = mode === 'hour' ? (h12 % 12) * 30 : min * 6;
  const tip = polar(handAngle, R_HAND);
  const labels =
    mode === 'hour'
      ? Array.from({ length: 12 }, (_, i) => ({ text: String(i === 0 ? 12 : i), angle: i * 30, active: (h12 % 12) === i }))
      : Array.from({ length: 12 }, (_, i) => ({ text: pad(i * 5), angle: i * 30, active: min === i * 5 }));

  const display = formatTime12(value);

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={display ? 'text-text' : 'text-text/40'}>{display || 'Select time'}</span>
        <svg className="w-4 h-4 text-text/70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Pick a time"
            style={{ position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, width: '272px', zIndex: 100 }}
            className="rounded-2xl bg-surface-solid shadow-2xl border border-primary/25 p-4"
          >
            {/* Digital readout + AM/PM (Fitts: large targets) */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <button type="button" onClick={() => setMode('hour')}
                className={`px-3 py-1 rounded-xl text-3xl font-extrabold tabular-nums transition-colors ${mode === 'hour' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                {pad(h12)}
              </button>
              <span className="text-3xl font-extrabold text-text/60">:</span>
              <button type="button" onClick={() => setMode('minute')}
                className={`px-3 py-1 rounded-xl text-3xl font-extrabold tabular-nums transition-colors ${mode === 'minute' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                {pad(min)}
              </button>
              <div className="flex flex-col gap-1 ml-1">
                {(['AM', 'PM'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPm(p === 'PM')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${((p === 'PM') === pm) ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Analog dial */}
            <svg
              ref={dial}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="w-full h-auto touch-none select-none cursor-pointer"
              role="slider"
              tabIndex={0}
              aria-label={mode === 'hour' ? 'Hour' : 'Minute'}
              aria-valuenow={mode === 'hour' ? h12 : min}
              aria-valuemin={mode === 'hour' ? 1 : 0}
              aria-valuemax={mode === 'hour' ? 12 : 59}
              onKeyDown={onKey}
              onPointerDown={(e) => {
                dragging.current = true;
                (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
                pick(e, false);
              }}
              onPointerMove={(e) => dragging.current && pick(e, false)}
              onPointerUp={(e) => {
                if (!dragging.current) return;
                dragging.current = false;
                pick(e, true);
              }}
            >
              <circle cx={C} cy={C} r={C - 2} fill="currentColor" className="text-primary/10" />
              <line x1={C} y1={C} x2={tip.x} y2={tip.y} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />
              <circle cx={C} cy={C} r="4" fill="currentColor" className="text-primary" />
              <circle cx={tip.x} cy={tip.y} r="17" fill="currentColor" className="text-primary" />
              {mode === 'minute' && min % 5 !== 0 && <circle cx={tip.x} cy={tip.y} r="3" fill="white" />}
              {labels.map((l) => {
                const p = polar(l.angle, R_NUM);
                return (
                  <text key={l.text} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                    className={`text-[14px] font-bold pointer-events-none ${l.active ? 'fill-white' : 'fill-current text-text'}`}>
                    {l.text}
                  </text>
                );
              })}
            </svg>

            <p className="text-center text-[11px] text-text/60 mt-1">
              {mode === 'hour' ? 'Tap or drag to set the hour' : 'Tap or drag to set the minute'}
            </p>

            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setOpen(false)} className="touch-target px-4 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10">Cancel</button>
              <button type="button" onClick={commit} className="touch-target px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary">OK</button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
