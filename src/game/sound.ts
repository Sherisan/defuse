/** Tiny Web Audio synth, so the game has sound without needing audio assets. */

const MUTE_KEY = 'defuse.muted';
let ctx: AudioContext | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function audio(): AudioContext | null {
  if (muted) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone(freq: number, dur: number, { type = 'sine', gain = 0.15, delay = 0, slideTo }: ToneOpts = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, { gain = 0.3, filter = 'highpass' as BiquadFilterType, freq = 2000, delay = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sound = {
  hover: () => tone(2400, 0.015, { type: 'square', gain: 0.012 }),
  arm: () => {
    tone(220, 0.08, { type: 'square', gain: 0.05 });
    tone(440, 0.1, { type: 'square', gain: 0.05, delay: 0.1 });
  },
  snip: () => {
    noise(0.05, { gain: 0.35, freq: 3500 });
    tone(1600, 0.04, { type: 'square', gain: 0.04 });
  },
  safe: () => {
    tone(660, 0.12, { type: 'triangle', gain: 0.14 });
    tone(990, 0.2, { type: 'triangle', gain: 0.12, delay: 0.08 });
  },
  boom: () => {
    noise(1.6, { gain: 0.9, filter: 'lowpass', freq: 800 });
    tone(110, 1.2, { gain: 0.6, slideTo: 28 });
  },
  scan: () => tone(300, 0.7, { type: 'sawtooth', gain: 0.03, slideTo: 1500 }),
  cash: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.12, delay: i * 0.07 })),
  defuse: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.12, delay: i * 0.08 }));
    tone(1568, 0.6, { gain: 0.08, delay: 0.45 });
  },
  isMuted: () => muted,
  setMuted(next: boolean) {
    muted = next;
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  },
};
