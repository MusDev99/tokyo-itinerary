import type { SeasonId } from './seasons';

/**
 * Short, quiet chimes played when a theme is picked. Synthesised with the Web Audio API,
 * so there are no audio files to load and nothing new for the CSP.
 */

export interface Note {
  type: OscillatorType;
  /** Start frequency in Hz */
  freq: number;
  /** Optional end frequency for a pitch glide (chirps, drops) */
  to?: number;
  /** Start offset in seconds */
  at: number;
  /** Length in seconds */
  dur: number;
  /** Peak gain before the master volume, 0..1 */
  gain: number;
  /** Fade-in in seconds (soft pads use a slow attack) */
  attack?: number;
}

const MASTER = 0.12;

export const CHIMES: Record<SeasonId, Note[]> = {
  // Wooden marimba taps, like stepping on dry leaves
  autumn: [
    { type: 'triangle', freq: 392, at: 0, dur: 0.22, gain: 0.9 },
    { type: 'triangle', freq: 587.33, at: 0.09, dur: 0.3, gain: 0.7 },
  ],
  // Glassy, high bell sparkle
  winter: [
    { type: 'sine', freq: 1318.5, at: 0, dur: 0.35, gain: 0.5 },
    { type: 'sine', freq: 1975.5, at: 0.07, dur: 0.35, gain: 0.4 },
    { type: 'sine', freq: 2637, at: 0.14, dur: 0.45, gain: 0.3 },
  ],
  // Two rising bird chirps
  spring: [
    { type: 'sine', freq: 1800, to: 2600, at: 0, dur: 0.09, gain: 0.45 },
    { type: 'sine', freq: 2000, to: 2900, at: 0.13, dur: 0.1, gain: 0.4 },
  ],
  // Bright major arpeggio
  summer: [
    { type: 'triangle', freq: 523.25, at: 0, dur: 0.18, gain: 0.7 },
    { type: 'triangle', freq: 659.25, at: 0.07, dur: 0.18, gain: 0.6 },
    { type: 'triangle', freq: 783.99, at: 0.14, dur: 0.3, gain: 0.6 },
  ],
  // Falling water drops
  rain: [
    { type: 'sine', freq: 1400, to: 500, at: 0, dur: 0.08, gain: 0.6 },
    { type: 'sine', freq: 1200, to: 450, at: 0.11, dur: 0.08, gain: 0.5 },
    { type: 'sine', freq: 1600, to: 550, at: 0.19, dur: 0.08, gain: 0.45 },
  ],
  // Soft, hazy pad (slow fade-in)
  haze: [
    { type: 'sine', freq: 220, at: 0, dur: 0.7, gain: 0.6, attack: 0.2 },
    { type: 'sine', freq: 329.63, at: 0, dur: 0.7, gain: 0.4, attack: 0.25 },
  ],
  // Low, calm bell
  night: [
    { type: 'sine', freq: 440, at: 0, dur: 0.9, gain: 0.6 },
    { type: 'sine', freq: 880, at: 0, dur: 0.6, gain: 0.2 },
  ],
};

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

let ctx: AudioContext | null = null;

/** Plays the chime for a theme. Call only from a user gesture (browsers block audio otherwise). */
export function playChime(id: SeasonId) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const n of CHIMES[id]) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const start = t0 + n.at;
      const end = start + n.dur;
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, start);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(n.gain * MASTER, start + (n.attack ?? 0.01));
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* no Web Audio: picking a theme still works silently */
  }
}
