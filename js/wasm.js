// Manipura — WASM engine loader (manipura.wasm).
// Thin wrapper: init, preset, f0, fwidth, h1Boost, render(float32, n).
// Engine is 1:1 with prism/generator. No changes to C++ here.

const WASM_URL = new URL('../wasm/build/manipura.js', import.meta.url).href;

let _engine = null;

export async function loadEngine() {
  if (_engine) return _engine;
  const mod = await import(WASM_URL);
  const M = await mod.default();
  _engine = M;
  return M;
}

export const VOWEL = { A: 0, O: 1, U: 2, Y: 3, I: 4, E: 5 };
export const VOWEL_KEYS = ["A","O","U","Y","I","E"];  // full set
export const VOWEL_KEYS_UI = ["A","O","U","E"];   // Manipura UI: 4 cardinal directions
export const PRESET = { STD: 0, MY: 1, HYB: 2 };

// Render n samples of the given vowel at sampleRate.
// Returns a fresh Float32Array(n) — copy, because HEAP can grow.
export function renderVowel(M, vowel, n, sampleRate, opts = {}) {
  const { f0 = 100, fwidth = 0.08, h1Boost = 1.0, preset = PRESET.STD, resetPhase = false } = opts;
  M._manipura_synth_set_preset(preset, VOWEL[vowel]);
  M._manipura_synth_set_f0(f0);
  M._manipura_synth_set_fwidth(fwidth);
  M._manipura_synth_set_h1_boost(h1Boost);
  if (resetPhase) M._manipura_synth_reset_phase();
  const ptr = M._malloc(n * 4);
  try {
    M._manipura_synth_render(ptr, n, sampleRate);
    return new Float32Array(M.HEAPF32.buffer, ptr, n).slice();
  } finally {
    M._free(ptr);
  }
}
