import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import { readSavedSeason, isSeason, type SeasonId } from '../utils/seasons';
import { prefersReducedMotion } from '../utils/motion';

type Controls = { stop: () => void; pause: () => void; play: () => void };

interface Ctx {
  root: HTMLElement;
  controls: Controls[];
  /** false when the user prefers reduced motion: gradients + static shapes only */
  motion: boolean;
  /** particle multiplier (fewer on small screens) */
  density: number;
  anim: (el: Element, keyframes: any, options: any) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const count = (ctx: Ctx, n: number) => Math.max(4, Math.round(n * ctx.density));

function node(parent: HTMLElement, style: Partial<CSSStyleDeclaration> | Record<string, string>, text?: string) {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'absolute', willChange: 'transform, opacity' }, style);
  if (text) el.textContent = text;
  parent.appendChild(el);
  return el;
}

/** Falling element that loops top → bottom with sideways sway (leaves, snow, petals). */
function faller(ctx: Ctx, o: { emoji?: string; size: [number, number]; dur: [number, number]; sway: number; spin: number; css?: Record<string, string>; n: number }) {
  if (!ctx.motion) return;
  for (let i = 0; i < count(ctx, o.n); i++) {
    const size = rand(o.size[0], o.size[1]);
    const dur = rand(o.dur[0], o.dur[1]);
    const el = node(ctx.root, { left: `${rand(-2, 100)}%`, top: '0', fontSize: `${size}px`, lineHeight: '1', opacity: String(rand(0.55, 0.95)), ...(o.css || {}), ...(o.emoji ? {} : { width: `${size}px`, height: `${size}px` }) }, o.emoji);
    ctx.anim(el, { y: ['-12vh', '112vh'] }, { duration: dur, repeat: Infinity, ease: 'linear', delay: -rand(0, dur) });
    ctx.anim(el, { x: [-o.sway, o.sway] }, { duration: rand(3, 6), repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: -rand(0, 4) });
    if (o.spin) ctx.anim(el, { rotate: [0, o.spin * (Math.random() > 0.5 ? 1 : -1)] }, { duration: rand(5, 9), repeat: Infinity, ease: 'linear' });
  }
}

function cloud(ctx: Ctx, o: { top: string; w: number; h: number; color: string; blur: number; dur: [number, number]; opacity: number }) {
  const el = node(ctx.root, { top: o.top, left: '-30vw', width: `${o.w}px`, height: `${o.h}px`, borderRadius: '50%', background: o.color, filter: `blur(${o.blur}px)`, opacity: String(o.opacity) });
  const dur = rand(o.dur[0], o.dur[1]);
  if (ctx.motion) ctx.anim(el, { x: ['0vw', '170vw'] }, { duration: dur, repeat: Infinity, ease: 'linear', delay: -rand(0, dur) });
  else el.style.left = `${rand(5, 70)}vw`;
  return el;
}

function twinkle(ctx: Ctx, o: { n: number; size: [number, number]; area: [number, number]; color: string; glow?: string }) {
  for (let i = 0; i < count(ctx, o.n); i++) {
    const s = rand(o.size[0], o.size[1]);
    const el = node(ctx.root, { left: `${rand(0, 100)}%`, top: `${rand(o.area[0], o.area[1])}%`, width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: o.color, boxShadow: o.glow ? `0 0 ${s * 3}px ${o.glow}` : 'none', opacity: String(rand(0.3, 0.9)) });
    if (ctx.motion) ctx.anim(el, { opacity: [0.15, 1, 0.15], scale: [0.7, 1.3, 0.7] }, { duration: rand(2, 6), repeat: Infinity, ease: 'easeInOut', delay: -rand(0, 6) });
  }
}

const SCENES: Record<SeasonId, { bg: string; build: (ctx: Ctx) => void }> = {
  autumn: {
    bg: 'linear-gradient(160deg,#ffe9b3 0%,#ffc062 45%,#f0894a 100%)',
    build(ctx) {
      for (const emoji of ['🍂', '🍁']) faller(ctx, { emoji, size: [18, 34], dur: [9, 18], sway: 40, spin: 360, n: 12 });
    },
  },
  winter: {
    bg: 'linear-gradient(180deg,#8ec1ec 0%,#cfe6f8 55%,#f4faff 100%)',
    build(ctx) {
      faller(ctx, { size: [3, 7], dur: [10, 18], sway: 24, spin: 0, n: 40, css: { borderRadius: '50%', background: 'rgba(255,255,255,.95)', boxShadow: '0 0 6px rgba(255,255,255,.8)' } });
      faller(ctx, { size: [8, 14], dur: [14, 24], sway: 36, spin: 0, n: 12, css: { borderRadius: '50%', background: 'rgba(255,255,255,.75)', filter: 'blur(2px)' } });
    },
  },
  spring: {
    bg: 'linear-gradient(160deg,#ffe1ee 0%,#ffc9e0 50%,#f7b2d1 100%)',
    build(ctx) {
      faller(ctx, { emoji: '🌸', size: [14, 28], dur: [10, 20], sway: 60, spin: 420, n: 22 });
    },
  },
  summer: {
    // Bright sky down to a warm golden horizon
    bg: 'linear-gradient(180deg,#2fa8ff 0%,#6cc9ff 38%,#bfe9ff 62%,#ffe98a 88%,#ffd24d 100%)',
    build(ctx) {
      const { root } = ctx;
      node(root, { right: '-6%', top: '-10%', width: '60vmin', height: '60vmin', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,236,130,.75) 0%, rgba(255,214,70,.35) 40%, transparent 70%)' });
      const halo = node(root, { right: '-12%', top: '-16%', width: '80vmin', height: '80vmin', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,245,170,.55) 0%, transparent 65%)' });
      const rays = node(root, { right: '4%', top: '2%', width: '34vmin', height: '34vmin' });
      for (let i = 0; i < 14; i++) {
        node(rays, { left: '50%', top: '50%', width: '10px', height: '48vmin', marginLeft: '-5px', transformOrigin: '50% 0%', transform: `rotate(${i * (360 / 14)}deg)`, background: 'linear-gradient(180deg, rgba(255,240,150,.7), rgba(255,240,150,0))', borderRadius: '6px' });
      }
      node(root, { right: '4%', top: '2%', width: '34vmin', height: '34vmin', borderRadius: '50%', background: 'radial-gradient(circle at 40% 38%, #fffde0 0%, #ffe45c 45%, #ffb400 100%)', boxShadow: '0 0 90px 40px rgba(255,200,40,.65)' });
      for (let i = 0; i < 3; i++) {
        node(root, { right: `${30 + i * 16}%`, top: `${14 + i * 13}%`, width: `${70 - i * 18}px`, height: `${70 - i * 18}px`, borderRadius: '50%', background: 'rgba(255,230,120,.22)', border: '1px solid rgba(255,255,255,.35)' });
      }
      cloud(ctx, { top: '14%', w: 260, h: 70, color: 'rgba(255,255,255,.9)', blur: 14, dur: [90, 140], opacity: 0.85 });
      cloud(ctx, { top: '34%', w: 340, h: 90, color: 'rgba(255,255,255,.8)', blur: 18, dur: [110, 170], opacity: 0.7 });
      cloud(ctx, { top: '52%', w: 220, h: 60, color: 'rgba(255,255,255,.8)', blur: 12, dur: [70, 110], opacity: 0.7 });
      twinkle(ctx, { n: 16, size: [3, 6], area: [20, 85], color: 'rgba(255,255,255,.95)', glow: 'rgba(255,255,200,.9)' });
      if (ctx.motion) {
        ctx.anim(halo, { scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }, { duration: 6, repeat: Infinity, ease: 'easeInOut' });
        ctx.anim(rays, { rotate: [0, 360] }, { duration: 90, repeat: Infinity, ease: 'linear' });
      }
    },
  },
  rain: {
    bg: 'linear-gradient(180deg,#3e4f65 0%,#62768c 50%,#93a8bc 100%)',
    build(ctx) {
      const { root } = ctx;
      cloud(ctx, { top: '-6%', w: 520, h: 150, color: 'rgba(40,52,70,.85)', blur: 40, dur: [90, 140], opacity: 0.9 });
      cloud(ctx, { top: '4%', w: 420, h: 120, color: 'rgba(55,70,90,.8)', blur: 34, dur: [70, 110], opacity: 0.85 });
      if (ctx.motion) {
        for (let i = 0; i < count(ctx, 70); i++) {
          const len = rand(34, 90);
          const dur = rand(0.55, 1.1);
          const el = node(root, { left: `${rand(-5, 105)}%`, top: '0', width: '1.6px', height: `${len}px`, background: 'linear-gradient(180deg, rgba(220,235,255,0), rgba(220,235,255,.75))', transform: 'rotate(12deg)', opacity: String(rand(0.35, 0.85)) });
          ctx.anim(el, { y: ['-15vh', '112vh'], x: ['0vw', '-6vw'] }, { duration: dur, repeat: Infinity, ease: 'linear', delay: -rand(0, dur) });
        }
        for (let i = 0; i < count(ctx, 10); i++) {
          const el = node(root, { left: `${rand(2, 96)}%`, bottom: `${rand(2, 16)}%`, width: '46px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(220,235,255,.65)' });
          ctx.anim(el, { scale: [0, 1.6], opacity: [0.8, 0] }, { duration: rand(1.2, 2.2), repeat: Infinity, ease: 'easeOut', delay: -rand(0, 2) });
        }
        const flash = node(root, { inset: '0', background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.9), rgba(200,220,255,.3) 60%, transparent)', opacity: '0' });
        ctx.anim(flash, { opacity: [0, 0, 0.8, 0, 0.5, 0, 0] }, { duration: 12, times: [0, 0.85, 0.86, 0.88, 0.89, 0.93, 1], repeat: Infinity, ease: 'linear' });
      }
    },
  },
  haze: {
    bg: 'linear-gradient(180deg,#b79c78 0%,#cdb694 45%,#e3d3b8 100%)',
    build(ctx) {
      const { root } = ctx;
      const sun = node(root, { left: '62%', top: '8%', width: '34vmin', height: '34vmin', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,200,.95) 0%, rgba(255,226,160,.5) 45%, transparent 72%)', filter: 'blur(6px)' });
      if (ctx.motion) ctx.anim(sun, { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }, { duration: 9, repeat: Infinity, ease: 'easeInOut' });
      [{ top: '4%', h: 26, o: 0.65, d: 38 }, { top: '24%', h: 30, o: 0.75, d: 46 }, { top: '46%', h: 32, o: 0.7, d: 32 }, { top: '66%', h: 30, o: 0.75, d: 52 }].forEach((b, i) => {
        const el = node(root, { left: '-30vw', top: b.top, width: '160vw', height: `${b.h}vh`, background: 'radial-gradient(ellipse at center, rgba(255,250,240,.9) 0%, rgba(255,250,240,0) 70%)', filter: 'blur(36px)', opacity: String(b.o) });
        if (ctx.motion) ctx.anim(el, { x: [i % 2 ? '10vw' : '-10vw', i % 2 ? '-10vw' : '10vw'] }, { duration: b.d, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' });
      });
      if (ctx.motion) {
        for (let i = 0; i < count(ctx, 30); i++) {
          const s = rand(2, 5);
          const dur = rand(18, 36);
          const el = node(root, { left: `${rand(0, 100)}%`, top: '0', width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: 'rgba(255,240,205,.85)', filter: 'blur(.5px)' });
          ctx.anim(el, { y: ['108vh', '-8vh'], x: [0, rand(-50, 50)], opacity: [0, 0.9, 0] }, { duration: dur, repeat: Infinity, ease: 'linear', delay: -rand(0, dur) });
        }
      }
    },
  },
  night: {
    bg: 'linear-gradient(180deg,#040613 0%,#0a1238 45%,#1b1f5c 100%)',
    build(ctx) {
      const { root } = ctx;
      for (const [top, c, d] of [['10%', 'rgba(52,211,153,.30)', 18], ['26%', 'rgba(167,139,250,.28)', 24]] as const) {
        const a = node(root, { left: '-20vw', top, width: '140vw', height: '22vh', borderRadius: '50%', background: `linear-gradient(90deg, transparent, ${c}, transparent)`, filter: 'blur(40px)' });
        if (ctx.motion) ctx.anim(a, { x: ['-6vw', '6vw'], scaleY: [0.8, 1.25], opacity: [0.5, 1] }, { duration: d, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' });
      }
      twinkle(ctx, { n: 80, size: [1, 3], area: [0, 75], color: '#fff', glow: 'rgba(200,215,255,.9)' });
      const moon = node(root, { right: '9%', top: '8%', width: '84px', height: '84px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fffdf0, #f3e7b6 70%, #d9c985)', boxShadow: '0 0 60px 18px rgba(255,240,180,.35)' });
      if (ctx.motion) {
        ctx.anim(moon, { scale: [1, 1.05, 1] }, { duration: 8, repeat: Infinity, ease: 'easeInOut' });
        for (let i = 0; i < 3; i++) {
          const s = node(root, { left: `${rand(10, 70)}%`, top: `${rand(2, 30)}%`, width: '140px', height: '2px', background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)', borderRadius: '2px', opacity: '0', transform: 'rotate(32deg)' });
          const gap = rand(6, 14);
          ctx.anim(s, { x: ['0px', '320px'], y: ['0px', '200px'], opacity: [0, 1, 0] }, { duration: 1.1, repeat: Infinity, repeatDelay: gap, ease: 'easeIn', delay: rand(1, gap) });
        }
      }
    },
  },
};

export default function SeasonBackground() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;

    const reduced = prefersReducedMotion();
    const density = window.innerWidth < 640 ? 0.55 : 1;
    let current: { id: SeasonId; el: HTMLElement; controls: Controls[] } | null = null;

    const mount = (id: SeasonId, instant: boolean) => {
      const def = SCENES[id];
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'absolute', inset: '0', overflow: 'hidden', background: def.bg, opacity: instant ? '1' : '0' });
      hostEl.appendChild(el);

      const controls: Controls[] = [];
      const ctx: Ctx = {
        root: el,
        controls,
        motion: !reduced,
        density,
        anim: (target, keyframes, options) => controls.push(animate(target, keyframes, options) as unknown as Controls),
      };
      def.build(ctx);

      const prev = current;
      current = { id, el, controls };
      if (!instant) {
        animate(el, { opacity: [0, 1] }, { duration: 0.9, ease: 'easeInOut' });
      }
      if (prev) {
        const done = () => {
          prev.controls.forEach((c) => c.stop());
          prev.el.remove();
        };
        if (instant) done();
        else animate(prev.el, { opacity: [1, 0] }, { duration: 0.9, ease: 'easeInOut' }).then(done);
      }
    };

    mount(readSavedSeason(), true);

    const onTheme = (e: Event) => {
      const id = (e as CustomEvent).detail?.theme;
      if (isSeason(id) && id !== current?.id) mount(id, false);
    };
    // Pause everything while the tab is hidden
    const onVisibility = () => {
      current?.controls.forEach((c) => (document.hidden ? c.pause() : c.play()));
    };
    document.addEventListener('theme-changed', onTheme);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('theme-changed', onTheme);
      document.removeEventListener('visibilitychange', onVisibility);
      current?.controls.forEach((c) => c.stop());
    };
  }, []);

  return <div ref={host} aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" />;
}
