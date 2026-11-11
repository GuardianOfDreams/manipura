// Manipura — 5-voice mix: 4 vowels (A,O,U,E) + center (pure F0 sine).
// Weights from IMU (beta, gamma) via setWeights(). Web Audio gains smoothed 20ms.
// AudioBufferSourceNode per vowel, OscillatorNode for center. Reliable on iOS.

import { loadEngine, renderVowel, PRESET } from './wasm.js';

const SR = 48000;
const BUFFER_SEC = 1.0;
const SMOOTH_SEC = 0.02;
const TARGET_PEAK = 0.9;
const F0 = 100;

const VOWELS = ["A", "O", "U", "E"];

function normalize(pcm, target = TARGET_PEAK) {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
  if (peak < 1e-6) return pcm;
  const g = target / peak;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
  return pcm;
}

function makeBuffer(ctx, pcm) {
  const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
  buf.copyToChannel(pcm, 0);
  return buf;
}

// weights in [0..1], sum <= 1. center = 1 - sum.
export class ManipuraAudio {
  constructor() {
    this.ctx = null;
    this.M = null;
    this.buffers = new Map();   // vowel -> AudioBuffer
    this.sources = new Map();   // vowel -> AudioBufferSourceNode (looping)
    this.vGains = new Map();    // vowel -> GainNode
    this.centerOsc = null;      // OscillatorNode (F0)
    this.centerGain = null;     // GainNode
    this.master = null;         // GainNode -> destination
    this.running = false;
    this.masterGain = 0.5;
    this.weights = { A: 0, O: 0, U: 0, E: 0, C: 1 };
  }

  async init() {
    this.M = await loadEngine();
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    for (const v of VOWELS) this._renderBuffer(v);
    return this;
  }

  _renderBuffer(vowel) {
    const n = Math.round(SR * BUFFER_SEC);
    const raw = renderVowel(this.M, vowel, n, SR, { f0: F0, fwidth: 0.08, preset: PRESET.STD, resetPhase: true });
    this.buffers.set(vowel, makeBuffer(this.ctx, normalize(raw)));
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  // Build source+gains once; only gains change over time.
  _buildGraph() {
    const now = this.ctx.currentTime;
    for (const v of VOWELS) {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.get(v);
      src.loop = true;
      src.connect(g);
      src.start(now);
      this.vGains.set(v, g);
      this.sources.set(v, src);
    }
    this.centerOsc = this.ctx.createOscillator();
    this.centerOsc.type = "sine";
    this.centerOsc.frequency.value = F0;
    this.centerGain = this.ctx.createGain();
    this.centerGain.gain.value = 0;
    this.centerOsc.connect(this.centerGain);
    this.centerGain.connect(this.master);
    this.centerOsc.start(now);
  }

  start(weights) {
    if (this.running) return;
    if (!this.sources.size) this._buildGraph();
    this.running = true;
    this._applyWeights(weights || this.weights);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(this.masterGain, now + SMOOTH_SEC);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + SMOOTH_SEC);
  }

  setWeights(w) {
    this.weights = w;
    if (this.running) this._applyWeights(w);
  }

  _applyWeights(w) {
    const now = this.ctx.currentTime;
    const t = now + SMOOTH_SEC;
    for (const v of VOWELS) {
      const g = this.vGains.get(v);
      if (!g) continue;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(w[v] || 0, t);
    }
    if (this.centerGain) {
      this.centerGain.gain.cancelScheduledValues(now);
      this.centerGain.gain.setValueAtTime(this.centerGain.gain.value, now);
      this.centerGain.gain.linearRampToValueAtTime(w.C || 0, t);
    }
  }

  setMasterGain(g) {
    this.masterGain = g;
    if (this.master && this.running) {
      this.master.gain.linearRampToValueAtTime(g, this.ctx.currentTime + 0.05);
    }
  }
}

// Weights from IMU. beta/gamma in degrees.
//   gamma < 0 -> A (left),  gamma > 0 -> E (right)
//   beta  < 0 -> U (front), beta  > 0 -> O (back)
// sum<=1: center = 1 - sum. sum>1: normalize, center = 0.
export function weightsFromIMU(beta, gamma) {
  const a = Math.max(0, -gamma / 90);
  const e = Math.max(0,  gamma / 90);
  const u = Math.max(0, -beta  / 90);
  const o = Math.max(0,  beta  / 90);
  const sum = a + e + u + o;
  if (sum <= 1) return { A: a, O: o, U: u, E: e, C: 1 - sum };
  return { A: a/sum, O: o/sum, U: u/sum, E: e/sum, C: 0 };
}
