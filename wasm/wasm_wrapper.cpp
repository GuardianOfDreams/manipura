/**
 * Manipura — WASM wrapper (synth only).
 *
 * Copied from prism/wasm/wasm_wrapper.cpp, analyzer parts removed.
 * Engine: generator/HarmonicSynth.h (header-only, copied from prism/generator).
 *
 * API (called from JS):
 *   _manipura_synth_init(sampleRate)
 *   _manipura_synth_set_preset(type, vowel)   0=STD 1=MY 2=HYB; 0=A 1=O 2=U 3=Y 4=I 5=E
 *   _manipura_synth_set_f0(f0)
 *   _manipura_synth_set_h1_boost(boost)
 *   _manipura_synth_set_fwidth(w)
 *   _manipura_synth_set_inharm(v)
 *   _manipura_synth_get_gains(double* out64)
 *   _manipura_synth_render(float* out, int n, sr)
 *   _manipura_synth_render_block(float* out, int n, sr)
 *   _manipura_synth_reset_phase()
 *   _manipura_synth_morph(vowelA, vowelB, t)
 */

#include <emscripten/emscripten.h>
#include <cstddef>

#include <generator/HarmonicSynth.h>

namespace {
    prism::generator::HarmonicSynth g_synth;
    double g_synthSampleRate = 44100.0;
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
void manipura_synth_init(double sampleRate) {
    g_synthSampleRate = (sampleRate > 0.0) ? sampleRate : 44100.0;
}

EMSCRIPTEN_KEEPALIVE
void manipura_synth_set_preset(int presetType, int vowel) {
    using PT = prism::generator::PresetType;
    using VI = prism::generator::VowelId;
    if (presetType < 0 || presetType > 2) presetType = 0;
    if (vowel < 0 || vowel > 5) vowel = 0;
    g_synth.setPreset(static_cast<PT>(presetType), static_cast<VI>(vowel));
}

EMSCRIPTEN_KEEPALIVE
void manipura_synth_set_f0(double f0) { g_synth.setF0(f0); }

EMSCRIPTEN_KEEPALIVE
void manipura_synth_set_h1_boost(double boost) { g_synth.setH1Boost(boost); }

EMSCRIPTEN_KEEPALIVE
void manipura_synth_set_fwidth(double w) { g_synth.setFWidth(w); }

EMSCRIPTEN_KEEPALIVE
void manipura_synth_set_inharm(double v) { g_synth.setInharm(v); }

EMSCRIPTEN_KEEPALIVE
void manipura_synth_get_gains(double* out64) {
    if (out64 == nullptr) return;
    g_synth.getFinalGains(out64);
}

EMSCRIPTEN_KEEPALIVE
int manipura_synth_render(float* out, int n, double sampleRate) {
    if (out == nullptr || n <= 0) return 0;
    const double sr = (sampleRate > 0.0) ? sampleRate : g_synthSampleRate;
    g_synth.renderPCM(out, n, sr);
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int manipura_synth_render_block(float* out, int n, double sampleRate) {
    if (out == nullptr || n <= 0) return 0;
    const double sr = (sampleRate > 0.0) ? sampleRate : g_synthSampleRate;
    g_synth.renderBlock(out, n, sr);
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void manipura_synth_reset_phase() { g_synth.resetPhase(); }

EMSCRIPTEN_KEEPALIVE
void manipura_synth_morph(int vowelA, int vowelB, double t) {
    using VI = prism::generator::VowelId;
    if (vowelA < 0 || vowelA > 5) vowelA = 0;
    if (vowelB < 0 || vowelB > 5) vowelB = 0;
    g_synth.morphStd(static_cast<VI>(vowelA), static_cast<VI>(vowelB), t);
}

} // extern "C"
