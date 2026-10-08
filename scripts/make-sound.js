// Generates assets/sounds/rest.wav: a soft, quiet two-note chime for the "rest over" notification.
// Usage: node scripts/make-sound.js   (tweak NOTES / VOLUME and re-run, then rebuild the app)
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const VOLUME = 0.22; // 0..1 — deliberately quiet
const NOTES = [ // [frequency Hz, start s, length s] — G5 then C6, like a gentle "ding-ding"
  [784, 0, 0.5],
  [1047, 0.18, 0.6],
];
const total = Math.max(...NOTES.map(([, s, l]) => s + l));
const samples = new Float32Array(Math.ceil(total * RATE));

for (const [f, start, len] of NOTES) {
  const s0 = Math.floor(start * RATE);
  for (let i = 0; i < len * RATE; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.01) * Math.exp(-t * 6); // 10 ms fade-in (no click), soft exponential decay
    samples[s0 + i] += env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)); // a touch of overtone = bell-ish
  }
}

const peak = Math.max(...samples.map(Math.abs));
const pcm = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => pcm.writeInt16LE(Math.round((v / peak) * VOLUME * 32767), i * 2));

const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);

const out = path.resolve(__dirname, '..', 'assets', 'sounds', 'rest.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log('wrote', out, `${total.toFixed(2)}s`);
