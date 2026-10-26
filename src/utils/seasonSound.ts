import type { SeasonId } from './seasons';

/**
 * Looping ambient soundscape for the selected theme (rain, wind, birds, crickets ...), synthesised with the
 * Web Audio API: no audio files to download and nothing new for the CSP. Browsers only allow audio after a
 * user gesture, so it starts on the first tap / key press and then keeps playing until muted.
 */

export type NoiseColor = 'white' | 'pink' | 'brown';

/** Continuous filtered noise (wind, rain, waves). `lfo` slowly swells the volume (gusts, waves). */
export interface NoiseLayer {
  color: NoiseColor;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  gain: number;
  lfo?: { rate: number; depth: number };
}

/** Sustained tone (pads, drones). */
export interface ToneLayer {
  type: OscillatorType;
  freq: number;
  gain: number;
  lfo?: { rate: number; depth: number };
}

/** Short sound that repeats at random intervals (a chirp, a drop, a rustle). */
export interface SoundEvent {
  kind: 'tone' | 'noise';
  /** Seconds between events, picked at random in [min, max] */
  every: [number, number];
  gain: number;
  dur: number;
  /** tone: start/end Hz (pitch glide); noise: band-pass centre Hz */
  freq: [number, number];
  /** Notes in a burst (crickets chirp in pulses, birds in pairs) */
  repeat?: number;
  /** Seconds between notes of a burst */
  gap?: number;
}

export interface Scene {
  noise?: NoiseLayer[];
  tones?: ToneLayer[];
  events?: SoundEvent[];
}

/** Overall loudness: ambience sits well under any page or system sound. */
export const MASTER = 0.35;
const FADE = 1.5;

export const SCENES: Record<SeasonId, Scene> = {
  // Gusty wind through trees, with dry leaves skittering
  autumn: {
    noise: [{ color: 'pink', filter: 'bandpass', freq: 500, q: 0.7, gain: 0.35, lfo: { rate: 0.12, depth: 0.6 } }],
    events: [{ kind: 'noise', every: [2.5, 6], gain: 0.12, dur: 0.18, freq: [3500, 3500], repeat: 3, gap: 0.07 }],
  },
  // Soft, low wind and the odd glassy sparkle
  winter: {
    noise: [{ color: 'brown', filter: 'lowpass', freq: 380, gain: 0.45, lfo: { rate: 0.07, depth: 0.5 } }],
    events: [{ kind: 'tone', every: [5, 11], gain: 0.05, dur: 0.9, freq: [1975, 1975] }],
  },
  // Light breeze with birds calling
  spring: {
    noise: [{ color: 'pink', filter: 'highpass', freq: 1200, gain: 0.08, lfo: { rate: 0.1, depth: 0.4 } }],
    events: [
      { kind: 'tone', every: [1.8, 4.5], gain: 0.07, dur: 0.08, freq: [2200, 3200], repeat: 2, gap: 0.12 },
      { kind: 'tone', every: [4, 9], gain: 0.05, dur: 0.18, freq: [3000, 1900] },
    ],
  },
  // Slow ocean waves on a warm afternoon
  summer: {
    noise: [{ color: 'brown', filter: 'lowpass', freq: 650, gain: 0.5, lfo: { rate: 0.09, depth: 0.85 } }],
    events: [{ kind: 'tone', every: [5, 10], gain: 0.04, dur: 0.1, freq: [2600, 3400], repeat: 3, gap: 0.1 }],
  },
  // Steady rain with closer drops
  rain: {
    noise: [
      { color: 'pink', filter: 'lowpass', freq: 2200, gain: 0.4 },
      { color: 'white', filter: 'highpass', freq: 5000, gain: 0.05 },
    ],
    events: [{ kind: 'tone', every: [0.3, 1.2], gain: 0.05, dur: 0.06, freq: [1400, 500] }],
  },
  // Warm, hazy drone with faint air
  haze: {
    noise: [{ color: 'brown', filter: 'lowpass', freq: 300, gain: 0.2, lfo: { rate: 0.05, depth: 0.4 } }],
    tones: [
      { type: 'sine', freq: 110, gain: 0.12, lfo: { rate: 0.08, depth: 0.5 } },
      { type: 'sine', freq: 164.81, gain: 0.07, lfo: { rate: 0.06, depth: 0.5 } },
    ],
  },
  // Crickets over a calm, low pad
  night: {
    tones: [{ type: 'sine', freq: 146.83, gain: 0.06, lfo: { rate: 0.05, depth: 0.6 } }],
    noise: [{ color: 'brown', filter: 'lowpass', freq: 250, gain: 0.12 }],
    events: [{ kind: 'tone', every: [0.6, 1.6], gain: 0.035, dur: 0.035, freq: [4400, 4400], repeat: 3, gap: 0.06 }],
  },
};

/** Fills `out` with noise of the given colour, values in [-1, 1]. Pure apart from `rng` (tests inject it). */
export function fillNoise(out: Float32Array, color: NoiseColor, rng: () => number = Math.random): Float32Array {
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const white = rng() * 2 - 1;
    if (color === 'white') out[i] = white;
    else if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02; // integrated (red) noise: deep rumble
      out[i] = last * 3.5;
    } else {
      // Paul Kellet's economy pink filter: softer than white, natural for rain and wind
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
    out[i] = Math.max(-1, Math.min(1, out[i]));
  }
  return out;
}

/** Seconds until the next event, uniformly in [min, max]. */
export const nextDelay = ([min, max]: [number, number], rng: () => number = Math.random) => min + rng() * (max - min);

const SOUND_KEY = 'theme-sound';

/** Sound is on unless the viewer muted it. */
export function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: the toggle still works for this page */
  }
}

interface Playing {
  id: SeasonId;
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  timers: number[];
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: Playing | null = null;
const noiseCache = new Map<NoiseColor, AudioBuffer>();

function noiseBuffer(ac: AudioContext, color: NoiseColor) {
  let buf = noiseCache.get(color);
  if (!buf) {
    buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate); // 4s loop: long enough to never sound repetitive
    fillNoise(buf.getChannelData(0), color);
    noiseCache.set(color, buf);
  }
  return buf;
}

/** Slow volume swell: an oscillator added onto a gain param (gusts, waves, breathing pads). */
function swell(ac: AudioContext, param: AudioParam, base: number, lfo: { rate: number; depth: number }, p: Playing) {
  const osc = ac.createOscillator();
  const depth = ac.createGain();
  osc.frequency.value = lfo.rate;
  // Swings between base * (1 - depth) and base, never below silence
  depth.gain.value = (base * lfo.depth) / 2;
  param.value = base * (1 - lfo.depth / 2);
  osc.connect(depth).connect(param);
  osc.start();
  p.sources.push(osc);
}

function fire(ac: AudioContext, e: SoundEvent, p: Playing) {
  const t0 = ac.currentTime + 0.02;
  for (let n = 0; n < (e.repeat ?? 1); n++) {
    const start = t0 + n * (e.gap ?? 0);
    const end = start + e.dur;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(e.gain, start + Math.min(0.01, e.dur / 3));
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    amp.connect(p.out);
    let src: AudioScheduledSourceNode;
    if (e.kind === 'tone') {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(e.freq[0], start);
      if (e.freq[1] !== e.freq[0]) osc.frequency.exponentialRampToValueAtTime(e.freq[1], end);
      osc.connect(amp);
      src = osc;
    } else {
      const noise = ac.createBufferSource();
      noise.buffer = noiseBuffer(ac, 'white');
      const band = ac.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = e.freq[0];
      band.Q.value = 1.2;
      noise.connect(band).connect(amp);
      src = noise;
    }
    src.start(start, src instanceof AudioBufferSourceNode ? Math.random() * 3 : undefined);
    src.stop(end + 0.05);
  }
}

function schedule(ac: AudioContext, e: SoundEvent, p: Playing) {
  const id = window.setTimeout(() => {
    p.timers = p.timers.filter((t) => t !== id);
    if (current !== p || ac.state !== 'running') return schedule(ac, e, p); // paused: try again later
    fire(ac, e, p);
    schedule(ac, e, p);
  }, nextDelay(e.every) * 1000);
  p.timers.push(id);
}

function build(ac: AudioContext, id: SeasonId): Playing {
  const scene = SCENES[id];
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(master!);
  const p: Playing = { id, out, sources: [], timers: [] };

  for (const layer of scene.noise ?? []) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, layer.color);
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = layer.filter;
    filter.frequency.value = layer.freq;
    if (layer.q) filter.Q.value = layer.q;
    const amp = ac.createGain();
    amp.gain.value = layer.gain;
    if (layer.lfo) swell(ac, amp.gain, layer.gain, layer.lfo, p);
    src.connect(filter).connect(amp).connect(out);
    src.start(0, Math.random() * 3);
    p.sources.push(src);
  }
  for (const tone of scene.tones ?? []) {
    const osc = ac.createOscillator();
    osc.type = tone.type;
    osc.frequency.value = tone.freq;
    const amp = ac.createGain();
    amp.gain.value = tone.gain;
    if (tone.lfo) swell(ac, amp.gain, tone.gain, tone.lfo, p);
    osc.connect(amp).connect(out);
    osc.start();
    p.sources.push(osc);
  }
  for (const e of scene.events ?? []) schedule(ac, e, p);

  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(1, ac.currentTime + FADE);
  return p;
}

function release(ac: AudioContext, p: Playing) {
  p.timers.forEach((t) => clearTimeout(t));
  p.timers = [];
  const now = ac.currentTime;
  p.out.gain.cancelScheduledValues(now);
  p.out.gain.setValueAtTime(p.out.gain.value, now);
  p.out.gain.linearRampToValueAtTime(0, now + FADE);
  for (const s of p.sources) {
    try {
      s.stop(now + FADE + 0.05);
    } catch {
      /* already stopped */
    }
  }
  window.setTimeout(() => p.out.disconnect(), (FADE + 0.2) * 1000);
}

/**
 * Starts the soundscape for a theme, or crossfades to it if another is playing.
 * Call from a user gesture the first time (browsers keep the context suspended otherwise).
 */
export function playAmbient(id: SeasonId) {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    if (current?.id === id) return;
    if (current) release(ctx, current);
    current = build(ctx, id);
  } catch {
    /* no Web Audio: the theme still works silently */
  }
}

/** Fades the soundscape out (mute). */
export function stopAmbient() {
  if (!ctx || !current) return;
  release(ctx, current);
  current = null;
}

/** Pause while the tab is hidden so nothing plays in the background of the device. */
export function pauseAmbient(paused: boolean) {
  if (!ctx) return;
  if (paused) void ctx.suspend();
  else if (current) void ctx.resume();
}

export const isAmbientPlaying = () => !!current && ctx?.state === 'running';
