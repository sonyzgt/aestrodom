// Synthesises the Aestrodom Pass video's music into public/sfx/pass-music.wav (no samples, no licences).
// Cosmic and cinematic, 96 BPM in E minor, Em – C – G – D. The sections follow src/Pass.tsx:
// starfield intro with a riser into the card reveal (impact at 3.33 s), a floating reveal, the beat drops
// at 9.33 s for the perks, a breakdown with a riser into the mint reveal (impact at 23.33 s), outro.
// Usage: node make-pass-music.mjs [seconds]
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = "public/sfx";
mkdirSync(OUT, { recursive: true });

let seed = 1357911;
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

const LENGTH = Number(process.argv[2] ?? 32);
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
// E minor: Em9, Cmaj7, G6, D (bass roots and chord tones).
const CHORDS = [
  { root: 40, notes: [52, 55, 59, 62, 66] },
  { root: 36, notes: [52, 55, 59, 64, 67] },
  { root: 43, notes: [50, 55, 59, 62, 64] },
  { root: 38, notes: [50, 54, 57, 62, 66] },
];

const T_REVEAL = 3.33;
const T_DROP1 = 9.33;
const T_BREAK = 20.8;
const T_DROP2 = 23.33;
const T_END = LENGTH - 2.5;

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
const full = (t) => between(t, T_DROP1, T_BREAK) || between(t, T_DROP2, T_END);
const master = (t) => Math.min(1, t / 0.8) * Math.max(0, Math.min(1, (LENGTH - t) / 3));
// Chords change every bar, counted from the card reveal so the harmony lands on the scene cuts.
const chordAt = (t) => CHORDS[((Math.floor((t - T_REVEAL) / BAR) % 4) + 4) % 4];

const beats = [];
for (let t = T_DROP1; t < LENGTH; t += BEAT) if (full(t)) beats.push(t);
const duckArr = new Float32Array(N).fill(1);
for (const k of beats)
  if (Math.round((k - T_DROP1) / BEAT) % 2 === 0)
    for (let s = 0; s < 0.5 * SR; s++) {
      const i = Math.round(k * SR) + s;
      if (i < N) duckArr[i] = Math.min(duckArr[i], 1 - 0.45 * Math.exp(-(s / SR) * 7));
    }
const duck = (t) => duckArr[Math.min(N - 1, Math.max(0, Math.round(t * SR)))];

/* Space drone: low E with a slow shimmer, always on. */
{
  let p1 = 0;
  let p2 = 0;
  for (let s = 0; s < N; s++) {
    const t = s / SR;
    p1 += midi(28) / SR;
    p2 += (midi(40) * 1.002) / SR;
    const x = (Math.sin(2 * Math.PI * p1) * 0.5 + Math.sin(2 * Math.PI * p2) * 0.25) * (0.06 + 0.03 * Math.sin(2 * Math.PI * 0.2 * t));
    add(s, x, x);
  }
}

/* Pad: wide detuned saws through a slow filter, brighter once the beat is in. */
for (let start = T_REVEAL - BAR; start < LENGTH; start += BAR) {
  const chord = chordAt(start + 0.01);
  const len = BAR + 0.6;
  chord.notes.forEach((note, v) => {
    [-1, 1].forEach((side) => {
      const f = midi(note) * 2 ** ((side * 11) / 1200);
      let phase = rand() * 0.5 + 0.5;
      let y1 = 0;
      let y2 = 0;
      for (let s = 0; s < len * SR; s++) {
        const t = start + s / SR;
        if (t < 0) continue;
        const u = s / SR;
        phase = (phase + f / SR) % 1;
        const saw = 2 * phase - 1;
        const open =
          t < T_REVEAL
            ? 350 + 500 * (t / T_REVEAL)
            : full(t)
              ? 1700
              : between(t, T_BREAK, T_DROP2)
                ? 500 + 2200 * ((t - T_BREAK) / (T_DROP2 - T_BREAK)) ** 2
                : 1100;
        const fc = open + 300 * Math.sin(2 * Math.PI * 0.09 * t + v);
        y1 += lp(fc) * (saw - y1);
        y2 += lp(fc) * (y1 - y2);
        const env = Math.min(1, u / 0.6) * (u > BAR ? Math.max(0, 1 - (u - BAR) / 0.6) : 1);
        const g = y2 * env * 0.05 * duck(t) * (t < T_REVEAL ? 0.6 : 1);
        add(Math.round(t * SR), side < 0 ? g : g * 0.45, side < 0 ? g * 0.45 : g);
      }
    });
  });
}

/* Star bells: 8th-note arpeggio over the chord, ping-ponged left and right with an echo. */
for (let t = 0.4, k = 0; t < LENGTH - 1; t += BEAT / 2, k++) {
  const chord = chordAt(t);
  const order = [0, 2, 4, 3, 1, 3, 2, 4];
  const f = midi(chord.notes[order[k % order.length]] + 12);
  const level = t < T_REVEAL ? 0.02 + 0.04 * (t / T_REVEAL) : between(t, T_BREAK, T_DROP2) ? 0.035 : 0.055;
  const pan = k % 2 === 0 ? [1, 0.4] : [0.4, 1];
  for (let s = 0; s < 1.2 * SR; s++) {
    const u = s / SR;
    const x = (Math.sin(2 * Math.PI * f * u) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * u) * Math.exp(-u * 10)) * Math.exp(-u * 3.2) * level;
    add(Math.round((t + u) * SR), x * pan[0], x * pan[1]);
    add(Math.round((t + u + BEAT * 0.75) * SR), x * pan[1] * 0.35, x * pan[0] * 0.35);
  }
}

/* Lead: a slow, wide melody over the beat sections. */
const MELODY = [
  [0, 71, 1.5],
  [1.5, 74, 0.5],
  [2, 76, 2],
  [4, 74, 1],
  [5, 71, 1],
  [6, 69, 2],
];
for (let t = T_DROP1 + BAR * 2; t < T_END - 1; t += BAR * 2) {
  if (!full(t + 0.01)) continue;
  for (const [off, note, dur] of MELODY) {
    const at = t + off * BEAT;
    if (!full(at)) continue;
    const f = midi(note);
    const d = dur * BEAT + 0.4;
    let ph = 0;
    for (let s = 0; s < d * SR; s++) {
      const u = s / SR;
      ph += (f * (1 + 0.004 * Math.sin(2 * Math.PI * 5 * u) * Math.min(1, u / 0.4))) / SR;
      const tri = 2 * Math.abs(2 * (ph % 1) - 1) - 1;
      const env = Math.min(1, u / 0.05) * Math.max(0, Math.min(1, (d - u) / 0.4));
      const x = tri * env * 0.07;
      add(Math.round((at + u) * SR), x * 0.8, x);
    }
  }
}

/* Sub bass: long notes following the root. */
for (let t = T_REVEAL; t < T_END; t += BEAT) {
  if (between(t, T_BREAK, T_DROP2)) continue;
  const f = midi(chordAt(t).root - 12);
  const level = full(t) ? 0.32 : 0.18;
  for (let s = 0; s < BEAT * SR; s++) {
    const u = s / SR;
    const x = Math.sin(2 * Math.PI * f * u) * Math.min(1, u / 0.01) * Math.min(1, (BEAT - u) / 0.03) * level * duck(t + u);
    add(Math.round((t + u) * SR), x);
  }
}

/* Drums: half-time cinematic groove. */
function kick(at, level = 0.65) {
  let ph = 0;
  for (let s = 0; s < 0.45 * SR; s++) {
    const u = s / SR;
    ph += (45 + 120 * Math.exp(-u * 30)) / SR;
    add(Math.round((at + u) * SR), Math.sin(2 * Math.PI * ph) * Math.exp(-u * 7) * level);
  }
}
function clap(at, level = 0.5) {
  let y = 0;
  for (let s = 0; s < 0.35 * SR; s++) {
    const u = s / SR;
    const n = rand();
    y += lp(3500) * (n - y);
    const burst = u < 0.03 ? 0.6 + 0.4 * Math.sin(u * 900) : 1;
    add(Math.round((at + u) * SR), (n - y) * Math.exp(-u * 13) * level * burst * 0.8, (n - y) * Math.exp(-u * 12) * level * burst);
  }
}
for (const k of beats) {
  const i = Math.round((k - T_DROP1) / BEAT) % 8;
  if (i === 0 || i === 4 || i === 5) kick(k);
  if (i === 2 || i === 6) clap(k);
}
// Hats: 8ths with a 16th roll at the end of every two bars.
for (let t = T_DROP1, k = 0; t < T_END; t += BEAT / 4, k++) {
  if (!full(t)) continue;
  const roll = k % 32 >= 28;
  if (k % 2 === 1 && !roll) continue;
  let y = 0;
  const level = k % 4 === 2 ? 0.09 : 0.05;
  for (let s = 0; s < 0.05 * SR; s++) {
    const u = s / SR;
    const n = rand();
    y += lp(9000) * (n - y);
    add(Math.round((t + u) * SR), (n - y) * Math.exp(-u * 80) * level * 0.8, (n - y) * Math.exp(-u * 80) * level);
  }
}
// Slow heartbeat under the reveal.
for (let t = T_REVEAL + BAR; t < T_DROP1 - 0.2; t += BAR / 2) kick(t, 0.4);
// Ticking under the breakdown.
for (let t = T_BREAK; t < T_DROP2; t += BEAT / 2) {
  for (let s = 0; s < 0.03 * SR; s++) {
    const u = s / SR;
    add(Math.round((t + u) * SR), Math.sin(2 * Math.PI * 2600 * u) * Math.exp(-u * 160) * 0.06);
  }
}

/* Risers into the reveal, the beat and the mint reveal. */
function riser(end, d, level) {
  let y1 = 0;
  let y2 = 0;
  for (let s = 0; s < d * SR; s++) {
    const u = s / SR;
    const p = u / d;
    const n = rand();
    y1 += lp(250 + 8000 * p * p) * (n - y1);
    y2 += lp(250 + 8000 * p * p) * (y1 - y2);
    const x = (n - y2) * p ** 2 * level;
    add(Math.round((end - d + u) * SR), x * 0.8, x);
  }
}
riser(T_REVEAL, 3, 0.22);
riser(T_DROP1, 1.6, 0.14);
riser(T_DROP2, 2.5, 0.24);

/* Impacts: deep boom + shimmer crash. */
function impact(at, level) {
  let ph = 0;
  let y = 0;
  for (let s = 0; s < 2.8 * SR; s++) {
    const u = s / SR;
    ph += (32 + 55 * Math.exp(-u * 10)) / SR;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-u * 2.2) * 0.7;
    const n = rand();
    y += lp(10000) * (n - y);
    const crash = (n - y * 0.5) * Math.exp(-u * 1.8) * 0.16;
    add(Math.round((at + u) * SR), (boom + crash) * level, (boom + crash * 1.1) * level);
  }
}
impact(T_REVEAL, 0.9);
impact(T_DROP1, 0.55);
impact(T_DROP2, 1);

/* Master: gentle saturation and fades. */
for (let i = 0; i < N; i++) {
  const g = master(i / SR);
  L[i] = Math.tanh(L[i] * 1.3) * g;
  R[i] = Math.tanh(R[i] * 1.3) * g;
}
wav("pass-music", [L, R], 0.85);
