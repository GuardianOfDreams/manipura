// Manipura — STD gains (logic).
// 1:1 port from prism/generator/Presets.h:157-173 (computeStdGains)
// and prism/generator/HarmonicSynth.h:135-147 (applyInvariants), 83-91 (getFinalGains).
// Do not change formulas here without syncing with the C++ source.

import { kNumHarmonics, STD_SPECS, STD_U } from './std-presets.js';

export const DEFAULT_F0      = 100.0; // HarmonicSynth.h:17
export const DEFAULT_FWIDTH  = 0.08;  // HarmonicSynth.h:19
export const DEFAULT_H1BOOST = 1.0;   // HarmonicSynth.h:18

// computeStdGains (Presets.h:157-173).
export function stdGains(vowel, f0 = DEFAULT_F0, fwidth = DEFAULT_FWIDTH) {
  const out = new Float64Array(kNumHarmonics);
  if (vowel === 'U') {
    for (let i = 0; i < kNumHarmonics; i++) out[i] = STD_U[i];
    out[0] = 1.0;
    return out;
  }
  const spec = STD_SPECS[vowel];
  if (!spec) throw new Error('unknown vowel: ' + vowel);

  for (let i = 0; i < kNumHarmonics; i++) {
    const hFreq = f0 * (i + 1);
    let total = 0.01;
    for (let f = 0; f < 5; f++) {
      const dist  = Math.abs(hFreq - spec.freqs[f]);
      const width = spec.freqs[f] * fwidth;
      const gauss = Math.exp(-(dist * dist) / (2.0 * width * width));
      const linAmp = Math.pow(10.0, spec.amps[f] / 20.0);
      total += gauss * linAmp;
    }
    out[i] = Math.min(1.0, total);
  }
  out[0] = 1.0;
  return out;
}

// applyInvariants (HarmonicSynth.h:135-147). NOT applied to U by caller.
export function applyInvariants(gains) {
  const minH2 = gains[0] * 0.15;
  if (gains[0] > 0.1 && gains[1] < minH2) gains[1] = minH2;

  for (let i = 5; i < 10; i++) {
    if (gains[i] > gains[i - 1] && gains[i] > gains[i + 1] && gains[i] > 0.1) {
      const shoulder = gains[i] * 0.3;
      if (gains[i - 1] < shoulder) gains[i - 1] = shoulder;
      if (gains[i + 1] < shoulder) gains[i + 1] = shoulder;
    }
  }
}

// getFinalGains (HarmonicSynth.h:83-91).
export function getFinalGains(baseGains, h1Boost = DEFAULT_H1BOOST) {
  const out = new Float64Array(kNumHarmonics);
  for (let i = 0; i < kNumHarmonics; i++) {
    let g = baseGains[i];
    if (i === 0) g *= h1Boost;
    if (g > 1.5) g = 1.5;
    if (g < 0.0) g = 0.0;
    out[i] = g;
  }
  return out;
}

// Full STD chain: computeStdGains -> applyInvariants(if not U) -> getFinalGains.
export function stdChain(vowel, f0 = DEFAULT_F0, fwidth = DEFAULT_FWIDTH, h1Boost = DEFAULT_H1BOOST) {
  const base = stdGains(vowel, f0, fwidth);
  if (vowel !== 'U') applyInvariants(base);
  return getFinalGains(base, h1Boost);
}
