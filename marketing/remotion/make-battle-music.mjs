// Synthesises the Battleground video's music bed into public/sfx/battle-music.wav (no samples, no licences).
// 120 BPM in D minor, Dm – Bb – F – C. The sections follow src/Battle.tsx:
// intro 0–3.5 s, full beat to 21.3 s (impact when Sonar takes #1 at 18.2 s), a tense breakdown under the
// mystery box with a riser into the lid opening at 26 s, full again to the end.
// Usage: node make-battle-music.mjs [seconds]
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = "public/sfx";
mkdirSync(OUT, { recursive: true });

let seed = 7654321;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const lp = (fc) => 1 - Math.exp((-2 * Math.PI * Math.min(fc, SR * 0.45)) / SR);

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
  console.log(`${OUT}/${name}.wav`);
}

const LENGTH = Number(process.argv[2] ?? 38);
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
// D minor: Dm, Bb, F, C (bass roots and chord tones).
const CHORDS = [
  { root: 38, notes: [50, 53, 57, 62] },
  { root: 34, notes: [50, 53, 58, 62] },
  { root: 41, notes: [48, 53, 57, 60] },
  { root: 36, notes: [48, 52, 55, 60] },
];

const T_BEAT = 3.5;
const T_SNARE = 8;
const T_IMPACT1 = 18.2;
const T_BREAK = 21.3;
const T_DROP = 26;
const T_END = LENGTH - 1.5;

const N = Math.round(LENGTH * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const add = (i, l, r = l) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};
const between = (t, a, b) => t >= a && t < b;
const full = (t) => between(t, T_BEAT, T_BREAK) || between(t, T_DROP, T_END);
const master = (t) => Math.min(1, t / 1.2) * Math.max(0, Math.min(1, (LENGTH - t) / 2.5));
const chordAt = (t) => CHORDS[Math.floor(t / BAR) % CHORDS.length];

// Grid of beats in the full sections, for drums and the sidechain duck.
const beats = [];
for (let t = 0; t < LENGTH; t += BEAT) if (full(t)) beats.push(t);
const duckArr = new Float32Array(N).fill(1);
for (const k of beats)
  for (let s = 0; s < 0.45 * SR; s++) {
    const i = Math.round(k * SR) + s;
    if (i < N) duckArr[i] = Math.min(duckArr[i], 1 - 0.5 * Math.exp(-(s / SR) * 9));
  }
const duck = (t) => duckArr[Math.min(N - 1, Math.max(0, Math.round(t * SR)))];

/* Pad: detuned saws, darker in the breakdown. */
for (let b = 0; b * BAR < LENGTH; b++) {
  const chord = CHORDS[b % CHORDS.length];
  const start = b * BAR;
  const len = BAR + 0.5;
  chord.notes.forEach((note, v) => {
    [-1, 1].forEach((side) => {
      const f = midi(note) * 2 ** ((side * 9) / 1200);
      let phase = rand() * 0.5 + 0.5;
      let y1 = 0;
      let y2 = 0;
      for (let s = 0; s < len * SR; s++) {
        const t = start + s / SR;
        const u = s / SR;
        phase = (phase + f / SR) % 1;
        const saw = 2 * phase - 1;
        const open = between(t, T_BREAK, T_DROP) ? 380 + 1400 * Math.max(0, (t - (T_DROP - 3)) / 3) ** 2 : t < T_BEAT ? 400 + 900 * (t / T_BEAT) : 1300;
        const fc = open + 250 * Math.sin(2 * Math.PI * 0.11 * t + v);
        y1 += lp(fc) * (saw - y1);
        y2 += lp(fc) * (y1 - y2);
        const env = Math.min(1, u / 0.3) * (u > BAR ? Math.max(0, 1 - (u - BAR) / 0.5) : 1);
        const g = y2 * env * 0.06 * duck(t);
        add(Math.round(t * SR), side < 0 ? g : g * 0.5, side < 0 ? g * 0.5 : g);
      }
    });
  });
}

/* Ostinato: driving 8th-note saw stabs (root, fifth, octave). */
for (let t = 0, k = 0; t < T_END; t += BEAT / 2, k++) {
  const intro = t < T_BEAT;
  if (!full(t) && !intro) continue;
  const chord = chordAt(t);
  const pattern = [0, 0, 7, 0, 12, 0, 7, 10];
  const f = midi(chord.root + 24 + pattern[k % pattern.length]);
  const level = (intro ? 0.05 + 0.06 * (t / T_BEAT) : 0.11) * (k % 2 === 0 ? 1 : 0.75);
  let ph = rand() * 0.5 + 0.5;
  let y = 0;
  for (let s = 0; s < 0.2 * SR; s++) {
    const u = s / SR;
    ph = (ph + f / SR) % 1;
    y += lp(500 + 3500 * Math.exp(-u * 18)) * (2 * ph - 1 - y);
    const x = y * Math.exp(-u * 11) * level;
    add(Math.round((t + u) * SR), x * 0.85, x);
  }
}

/* Lead bell: a short motif every two bars in the full sections. */
const MOTIF = [
  [0, 74],
  [0.75, 72],
  [1.5, 69],
  [2.5, 72],
  [3, 74],
  [3.5, 77],
];
for (let t = 0; t < T_END; t += BAR * 2) {
  if (!full(t + 0.01) || t < T_SNARE) continue;
  for (const [off, note] of MOTIF) {
    const at = t + off * BEAT;
    const f = midi(note);
    for (let s = 0; s < 0.9 * SR; s++) {
      const u = s / SR;
      const x = (Math.sin(2 * Math.PI * f * u) + 0.3 * Math.sin(2 * Math.PI * f * 3.01 * u) * Math.exp(-u * 8)) * Math.exp(-u * 4) * 0.08;
      add(Math.round((at + u) * SR), x * 0.7, x);
      add(Math.round((at + u + BEAT * 0.75) * SR), x * 0.25, x * 0.1);
    }
  }
}

/* Sub bass: off-beat 8ths under the full sections. */
for (let t = BEAT / 2; t < T_END; t += BEAT) {
  if (!full(t)) continue;
  const f = midi(chordAt(t).root);
  for (let s = 0; s < 0.24 * SR; s++) {
    const u = s / SR;
    const x = (Math.sin(2 * Math.PI * f * u) + 0.25 * Math.sin(2 * Math.PI * f * 2 * u)) * Math.min(1, u / 0.004) * Math.exp(-u * 6) * 0.3;
    add(Math.round((t + u) * SR), x);
  }
}

/* Drums. */
function kick(at, level = 0.6) {
  let ph = 0;
  for (let s = 0; s < 0.4 * SR; s++) {
    const u = s / SR;
    ph += (48 + 110 * Math.exp(-u * 35)) / SR;
    add(Math.round((at + u) * SR), Math.sin(2 * Math.PI * ph) * Math.exp(-u * 8) * level);
  }
}
for (const k of beats) kick(k);
// Snare on 2 and 4.
for (const k of beats) {
  if (k < T_SNARE || Math.round(k / BEAT) % 2 === 0) continue;
  let y = 0;
  for (let s = 0; s < 0.22 * SR; s++) {
    const u = s / SR;
    const n = rand();
    y += lp(5000) * (n - y);
    const body = Math.sin(2 * Math.PI * 190 * u) * Math.exp(-u * 30) * 0.25;
    add(Math.round((k + u) * SR), (y * Math.exp(-u * 16) * 0.35 + body) * 0.9);
  }
}
// 16th hats.
for (let t = T_BEAT, k = 0; t < T_END; t += BEAT / 4, k++) {
  if (!full(t)) continue;
  let y = 0;
  const level = k % 4 === 2 ? 0.1 : 0.05;
  for (let s = 0; s < 0.04 * SR; s++) {
    const u = s / SR;
    const n = rand();
    y += lp(8000) * (n - y);
    add(Math.round((t + u) * SR), (n - y) * Math.exp(-u * 90) * level * 0.8, (n - y) * Math.exp(-u * 90) * level);
  }
}
// Snare roll into the drop of the first section, last bar before 8 s.
for (let t = T_SNARE - BAR / 2; t < T_SNARE; t += BEAT / 4) {
  let y = 0;
  const level = 0.15 + 0.25 * ((t - (T_SNARE - BAR / 2)) / (BAR / 2));
  for (let s = 0; s < 0.1 * SR; s++) {
    const u = s / SR;
    y += lp(4500) * (rand() - y);
    add(Math.round((t + u) * SR), y * Math.exp(-u * 30) * level);
  }
}

/* Breakdown: a slow heartbeat and a ticking clock under the mystery box. */
for (let t = T_BREAK; t < T_DROP - 0.3; t += BEAT * 2) {
  kick(t, 0.45);
  kick(t + 0.22, 0.3);
}
for (let t = T_BREAK; t < T_DROP; t += BEAT) {
  for (let s = 0; s < 0.03 * SR; s++) {
    const u = s / SR;
    add(Math.round((t + u) * SR), Math.sin(2 * Math.PI * 2400 * u) * Math.exp(-u * 160) * 0.08);
  }
}

/* Riser into the drop: filtered noise sweeping up. */
{
  const d = 3;
  let y1 = 0;
  let y2 = 0;
  for (let s = 0; s < d * SR; s++) {
    const u = s / SR;
    const p = u / d;
    const n = rand();
    y1 += lp(300 + 7000 * p * p) * (n - y1);
    y2 += lp(300 + 7000 * p * p) * (y1 - y2);
    const x = (n - y2) * p ** 2 * 0.25;
    add(Math.round((T_DROP - d + u) * SR), x * 0.8, x);
  }
}

/* Impacts: boom + crash at Sonar taking #1 and at the lid opening. */
function impact(at, level) {
  let ph = 0;
  let y = 0;
  for (let s = 0; s < 2.2 * SR; s++) {
    const u = s / SR;
    ph += (35 + 60 * Math.exp(-u * 12)) / SR;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-u * 2.5) * 0.7;
    const n = rand();
    y += lp(9000) * (n - y);
    const crash = (n - y * 0.5) * Math.exp(-u * 2.2) * 0.18;
    add(Math.round((at + u) * SR), (boom + crash) * level, (boom + crash * 1.1) * level);
  }
}
impact(T_IMPACT1, 0.7);
impact(T_DROP, 1);

/* Master: gentle saturation and fades. */
for (let i = 0; i < N; i++) {
  const g = master(i / SR);
  L[i] = Math.tanh(L[i] * 1.3) * g;
  R[i] = Math.tanh(R[i] * 1.3) * g;
}
wav("battle-music", [L, R], 0.85);
