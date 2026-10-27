// Synthesises every sound the demo uses into public/sfx/*.wav: no samples, no licences.
// Usage: node make-audio.mjs   (re-run after changing the video length in src/Demo.tsx)
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = "public/sfx";
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Deterministic noise so every render sounds identical. */
let seed = 1234567;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const lp = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);

function wav(name, channels, peak = 0.9) {
  const n = channels[0].length;
  let max = 0;
  for (const ch of channels) for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(ch[i]));
  const gain = max > 0 ? peak / max : 1;
  const buf = Buffer.alloc(44 + n * channels.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * channels.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels.length, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * channels.length * 2, 28);
  buf.writeUInt16LE(channels.length * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * channels.length * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (const ch of channels) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[i] * gain)) * 32767), o);
      o += 2;
    }
  writeFileSync(`${OUT}/${name}.wav`, buf);
  console.log(`${name}.wav  ${(n / SR).toFixed(2)}s`);
}

const mono = (seconds, fn) => {
  const a = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < a.length; i++) a[i] = fn(i / SR, i);
  return [a];
};

/* ------------------------------------------------------------------ */
/* UI sounds                                                           */
/* ------------------------------------------------------------------ */

// Mouse click: a bright tick for the press and a softer one for the release.
{
  let y = 0;
  wav(
    "click",
    mono(0.09, (t) => {
      const press = t < 0.03 ? (rand() * 0.6 + Math.sin(2 * Math.PI * 3200 * t)) * Math.exp(-t * 260) : 0;
      const rt = t - 0.045;
      const release = rt > 0 ? (rand() * 0.4 + Math.sin(2 * Math.PI * 2400 * rt)) * Math.exp(-rt * 320) * 0.45 : 0;
      const x = press + release;
      y += lp(6000) * (x - y);
      return y;
    }),
    0.8,
  );
}

// Three keyboard keys: band-limited clack plus a little body thump, each tuned slightly differently.
[
  [4200, 170],
  [3600, 150],
  [4800, 190],
].forEach(([tone, body], k) => {
  let y = 0;
  wav(
    `key${k + 1}`,
    mono(0.06, (t) => {
      const clack = rand() * Math.exp(-t * 180);
      y += lp(tone) * (clack - y);
      const thump = Math.sin(2 * Math.PI * body * t) * Math.exp(-t * 90) * 0.5;
      return y * 1.4 + thump;
    }),
    0.7,
  );
});

// Whoosh: noise through a low-pass that sweeps up and back down.
{
  let y1 = 0;
  let y2 = 0;
  const len = 0.7;
  wav(
    "whoosh",
    mono(len, (t) => {
      const p = t / len;
      const env = Math.sin(Math.PI * Math.min(1, p * 1.25)) ** 2;
      const fc = 300 + 3200 * Math.sin(Math.PI * p);
      y1 += lp(fc) * (rand() - y1);
      y2 += lp(fc) * (y1 - y2);
      return y2 * env;
    }),
    0.6,
  );
}

// Tick: the soft confirmation when a build step finishes.
wav(
  "tick",
  mono(0.12, (t) => (Math.sin(2 * Math.PI * 1760 * t) + 0.3 * Math.sin(2 * Math.PI * 3520 * t)) * Math.exp(-t * 55)),
  0.5,
);

// Chime: two bell notes a fifth apart, for "it worked" moments.
wav(
  "chime",
  mono(1.4, (t) => {
    const bell = (f, at) => {
      const u = t - at;
      if (u < 0) return 0;
      return (Math.sin(2 * Math.PI * f * u) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * u) * Math.exp(-u * 6) + 0.2 * Math.sin(2 * Math.PI * f * 5.4 * u) * Math.exp(-u * 10)) * Math.exp(-u * 3.2);
    };
    return bell(midi(88), 0) + bell(midi(95), 0.11) * 0.9;
  }),
  0.65,
);

// Pop: a short pitched blip for things that appear (logo, rank change).
wav(
  "pop",
  mono(0.18, (t) => Math.sin(2 * Math.PI * (300 + 900 * Math.exp(-t * 40)) * t) * Math.exp(-t * 28)),
  0.6,
);

// Swell: rising filtered noise plus a fifth, under the spotlight reveal.
{
  let y = 0;
  const len = 1.6;
  wav(
    "swell",
    mono(len, (t) => {
      const p = t / len;
      const env = p < 0.85 ? p ** 2 : (1 - (p - 0.85) / 0.15) * 0.72;
      y += lp(400 + 5000 * p * p) * (rand() - y);
      const tone = (Math.sin(2 * Math.PI * midi(57) * t) + Math.sin(2 * Math.PI * midi(64) * t)) * 0.25;
      return (y + tone) * env;
    }),
    0.6,
  );
}

/* ------------------------------------------------------------------ */
/* Music bed                                                           */
/* ------------------------------------------------------------------ */

// 96 BPM, Fmaj9 – Am7 – Cmaj7 – G, one chord per bar. Sections follow the video:
// pad from the start, arpeggio with the hero (4 s), drums and bass with the product demo (9 s), out at 46 s.
const LENGTH = Number(process.argv[2] ?? 49);
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64, 67] },
  { root: 45, notes: [57, 60, 64, 67] },
  { root: 36, notes: [55, 59, 60, 64] },
  { root: 43, notes: [55, 59, 62, 67] },
];
const T_ARP = 4;
const T_DRUMS = 9;
const T_CLAP = 16.5;
const T_OUT = 46;

const N = Math.round(LENGTH * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const add = (i, l, r = l) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};
const fadeIn = (t, at, d) => Math.max(0, Math.min(1, (t - at) / d));
const master = (t) => Math.min(1, t / 2.5) * Math.max(0, Math.min(1, (LENGTH - t) / 3));

// Kick times, for the pad's sidechain duck.
const kicks = [];
for (let t = T_DRUMS; t < T_OUT - 0.5; t += BEAT) kicks.push(t);
// Precomputed per sample: 1 between kicks, dipping to 0.65 on each one.
const duckArr = new Float32Array(N).fill(1);
for (const k of kicks)
  for (let s = 0; s < 0.6 * SR; s++) {
    const i = Math.round(k * SR) + s;
    if (i < N) duckArr[i] = Math.min(duckArr[i], 1 - 0.35 * Math.exp(-(s / SR) * 7));
  }
const duck = (t) => duckArr[Math.min(N - 1, Math.round(t * SR))];

// Pad: two detuned saws per chord tone, panned apart, through a breathing low-pass.
const bars = Math.ceil(LENGTH / BAR) + 1;
for (let b = 0; b < bars; b++) {
  const chord = CHORDS[b % CHORDS.length];
  const start = b * BAR;
  const len = BAR + 0.7;
  chord.notes.forEach((note, v) => {
    [-1, 1].forEach((side) => {
      const f = midi(note) * 2 ** ((side * 7) / 1200);
      let phase = rand() * 0.5 + 0.5;
      let y1 = 0;
      let y2 = 0;
      for (let s = 0; s < len * SR; s++) {
        const t = start + s / SR;
        const u = s / SR;
        phase = (phase + f / SR) % 1;
        const saw = 2 * phase - 1;
        const fc = 700 + 500 * Math.sin(2 * Math.PI * 0.07 * t + v);
        y1 += lp(fc) * (saw - y1);
        y2 += lp(fc) * (y1 - y2);
        const env = Math.min(1, u / 0.5) * (u > BAR ? Math.max(0, 1 - (u - BAR) / 0.7) : 1);
        const g = y2 * env * 0.07 * duck(t);
        add(Math.round(t * SR), side < 0 ? g : g * 0.55, side < 0 ? g * 0.55 : g);
      }
    });
  });
}

// Arpeggio: 16th-note plucks over the chord an octave up, with a ping-pong echo.
for (let t = T_ARP, k = 0; t < T_OUT; t += BEAT / 4, k++) {
  const chord = CHORDS[Math.floor(t / BAR) % CHORDS.length];
  const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
  const note = chord.notes[pattern[k % pattern.length] % chord.notes.length] + 12;
  const f = midi(note);
  const level = 0.11 * fadeIn(t, T_ARP, 3) * (k % 4 === 0 ? 1 : 0.7);
  for (let s = 0; s < 0.3 * SR; s++) {
    const u = s / SR;
    const x = (Math.sin(2 * Math.PI * f * u) + 0.25 * Math.sin(2 * Math.PI * f * 2 * u)) * Math.exp(-u * 14) * level;
    add(Math.round((t + u) * SR), x);
    add(Math.round((t + u + (BEAT * 3) / 4) * SR), x * 0.35, 0);
    add(Math.round((t + u + (BEAT * 3) / 2) * SR), 0, x * 0.15);
  }
}

// Bass: 8th-note sine pulses on the root.
for (let t = T_DRUMS; t < T_OUT; t += BEAT / 2) {
  const chord = CHORDS[Math.floor(t / BAR) % CHORDS.length];
  const f = midi(chord.root);
  for (let s = 0; s < 0.28 * SR; s++) {
    const u = s / SR;
    const x = (Math.sin(2 * Math.PI * f * u) + 0.2 * Math.sin(2 * Math.PI * f * 2 * u)) * Math.min(1, u / 0.005) * Math.exp(-u * 7) * 0.22 * fadeIn(t, T_DRUMS, 1);
    add(Math.round((t + u) * SR), x);
  }
}

// Drums: kick on every beat, closed hat on the off-beats, a soft clap on 2 and 4.
for (const k of kicks) {
  let ph = 0;
  for (let s = 0; s < 0.35 * SR; s++) {
    const u = s / SR;
    ph += (45 + 75 * Math.exp(-u * 30)) / SR;
    add(Math.round((k + u) * SR), Math.sin(2 * Math.PI * ph) * Math.exp(-u * 9) * 0.5);
  }
}
for (let t = T_DRUMS + BEAT / 2; t < T_OUT - 0.5; t += BEAT) {
  let y = 0;
  for (let s = 0; s < 0.05 * SR; s++) {
    const u = s / SR;
    const n = rand();
    y += lp(7000) * (n - y);
    add(Math.round((t + u) * SR), (n - y) * Math.exp(-u * 70) * 0.09, (n - y) * Math.exp(-u * 70) * 0.11);
  }
}
for (let t = T_CLAP + BEAT; t < T_OUT - 0.5; t += BEAT * 2) {
  let y1 = 0;
  let y2 = 0;
  for (let s = 0; s < 0.2 * SR; s++) {
    const u = s / SR;
    const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (u >= o ? Math.exp(-(u - o) * 40) : 0), 0);
    const n = rand();
    y1 += lp(2400) * (n - y1);
    y2 += lp(900) * (y1 - y2);
    add(Math.round((t + u) * SR), (y1 - y2) * bursts * 0.35);
  }
}

for (let i = 0; i < N; i++) {
  const g = master(i / SR);
  L[i] = Math.tanh(L[i] * 1.2) * g;
  R[i] = Math.tanh(R[i] * 1.2) * g;
}
wav("music", [L, R], 0.85);
