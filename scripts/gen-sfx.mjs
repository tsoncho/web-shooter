import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "assets", "sfx");
fs.mkdirSync(dir, { recursive: true });

function writeWav(file, samples, sr = 44100) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(path.join(dir, file), buf);
}

function env(t, a, d) {
  return Math.exp(-t * d) * (1 - Math.exp(-t * a));
}

function mk(dur, fn, sr = 44100) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / sr, i, n);
  return out;
}

writeWav(
  "shoot_pistol.wav",
  mk(0.14, (t) => {
    const e = Math.exp(-t * 28);
    return (Math.sin(2 * Math.PI * (220 + t * 1400) * t) * 0.45 + (Math.random() * 2 - 1) * 0.4) * e;
  })
);
writeWav(
  "shoot_smg.wav",
  mk(0.09, (t) => {
    const e = Math.exp(-t * 40);
    return (Math.sin(2 * Math.PI * (160 + t * 2000) * t) * 0.35 + (Math.random() * 2 - 1) * 0.45) * e;
  })
);
writeWav(
  "shoot_rifle.wav",
  mk(0.16, (t) => {
    const e = Math.exp(-t * 22);
    return (Math.sin(2 * Math.PI * (120 + t * 900) * t) * 0.5 + (Math.random() * 2 - 1) * 0.35) * e;
  })
);
writeWav(
  "hit.wav",
  mk(0.1, (t) => Math.sin(2 * Math.PI * (700 - t * 900) * t) * Math.exp(-t * 25) * 0.6)
);
writeWav(
  "headshot.wav",
  mk(0.12, (t) => Math.sin(2 * Math.PI * (1200 - t * 1400) * t) * Math.exp(-t * 20) * 0.7)
);
writeWav(
  "reload.wav",
  mk(0.35, (t) => {
    const click = t < 0.05 ? (Math.random() * 2 - 1) * 0.4 : 0;
    return click + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 8) * 0.2;
  })
);
writeWav(
  "footstep.wav",
  mk(0.12, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.35 * (0.5 + 0.5 * Math.sin(t * 60)))
);
writeWav(
  "plant.wav",
  mk(0.4, (t) => Math.sin(2 * Math.PI * (440 + (t * 8) | 0 * 0)) * env(t, 40, 6) * 0.35 + ((t * 10) % 1 < 0.15 ? 0.2 : 0) * Math.random())
);
writeWav(
  "defuse.wav",
  mk(0.5, (t) => Math.sin(2 * Math.PI * (520 + t * 40) * t) * Math.exp(-t * 3) * 0.3 + (Math.random() * 2 - 1) * 0.05 * Math.exp(-t * 4))
);
writeWav(
  "explode.wav",
  mk(0.9, (t) => {
    const e = Math.exp(-t * 3.5);
    return ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * 55 * t) * 0.4) * e;
  })
);
writeWav(
  "round.wav",
  mk(0.35, (t) => {
    const f = t < 0.15 ? 440 : 660;
    return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5) * 0.35;
  })
);

console.log("SFX written to", dir);
