import { Mp3Encoder } from "@breezystack/lamejs";

/** Convertit un flux PCM 16 bits little-endian mono en échantillons. */
export function pcm16FromBuffer(buf: Buffer): Int16Array {
  const n = buf.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

export function concatPcm(parts: Int16Array[]): Int16Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Remonte le niveau sonore vers une cible RMS (en dBFS), avec un limiteur doux
 * qui empêche la saturation. Modifie les échantillons en place. Ne baisse jamais le niveau.
 */
export function normalizeLoudness(samples: Int16Array, options: { targetRmsDb?: number; ceiling?: number; knee?: number; maxGainDb?: number } = {}) {
  const { targetRmsDb = -15, ceiling = 0.97, knee = 0.8, maxGainDb = 18 } = options;
  const n = samples.length;
  if (!n) return { gainDb: 0, rmsDbBefore: -Infinity };

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i] / 32768;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  if (rms < 1e-5) return { gainDb: 0, rmsDbBefore: -Infinity };

  const gain = Math.min(Math.max(1, Math.pow(10, targetRmsDb / 20) / rms), Math.pow(10, maxGainDb / 20));
  if (gain <= 1.01) return { gainDb: 0, rmsDbBefore: 20 * Math.log10(rms) };

  const range = ceiling - knee;
  for (let i = 0; i < n; i++) {
    let v = (samples[i] / 32768) * gain;
    const a = Math.abs(v);
    if (a > knee) v = Math.sign(v) * (knee + range * Math.tanh((a - knee) / range));
    samples[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
  }
  return { gainDb: 20 * Math.log10(gain), rmsDbBefore: 20 * Math.log10(rms) };
}

/** Encode des échantillons mono en MP3 (encodeur pur JavaScript). */
export function encodeMp3(samples: Int16Array, sampleRate: number, kbps = 96): Buffer {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const parts: Buffer[] = [];
  const block = 1152;
  for (let i = 0; i < samples.length; i += block) {
    const out = encoder.encodeBuffer(samples.subarray(i, i + block));
    if (out.length) parts.push(Buffer.from(out.buffer, out.byteOffset, out.byteLength));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(Buffer.from(tail.buffer, tail.byteOffset, tail.byteLength));
  return Buffer.concat(parts);
}
