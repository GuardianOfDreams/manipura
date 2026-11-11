// Manipura — audio engine. AudioBufferSourceNode (reliable on iOS/Telegram).
// Renders 1s PCM via WASM, normalizes per-vowel, loops, crossfades on change.
// AudioWorklet rejected: fetch/importScripts risks on Safari/Telegram WebView.

import { loadEngine, renderVowel, VOWEL_KEYS, PRESET } from './wasm.js';

const SR = 48000;
const BUFFER_SEC = 1.0;
const FADE_SEC = 0.02;
const TARGET_PEAK = 0.9;

// Per-vowel peak normalization table (measured, smoothed).
// Render raw, find peak, scale to TARGET_PEAK. Cache result.
const _cache = new Map();

function normalize(pcm, target = TARGET_PEAK) {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
  if (peak < 1e-6) return pcm;
  const g = target / peak;
  for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
  return pcm;
}

function makeAudioBuffer(ctx, pcm) {
  const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
  buf.copyToChannel(pcm, 0);
  return buf;
}

export class ManipuraAudio {
  constructor() {
    this.ctx = null;
    this.M = null;
    this.source = null;
    this.gain = null;
    this.buffers = new Map();  // vowel -> AudioBuffer (normalized)
    this.currentVowel = null;
    this.running = false;
    this.masterGain = 0.8;
    this.f0 = 100;
    this.fwidth = 0.08;
  }

  async init() {
    this.M = await loadEngine();
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.masterGain;
    this.gain.connect(this.ctx.destination);
    // Pre-render all 6 vowels at current params
    for (const v of VOWEL_KEYS) this._renderBuffer(v);
    return this;
  }

  _renderBuffer(vowel) {
    const n = Math.round(SR * BUFFER_SEC);
    const raw = renderVowel(this.M, vowel, n, SR, { f0: this.f0, fwidth: this.fwidth, preset: PRESET.STD, resetPhase: true });
    const norm = normalize(raw);
    this.buffers.set(vowel, makeAudioBuffer(this.ctx, norm));
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  setVowel(vowel) {
    if (!this.buffers.has(vowel)) return;
    if (this.currentVowel === vowel && this.running) return;
    this.currentVowel = vowel;
    if (!this.running) return;
    this._crossfadeTo(vowel);
  }

  _crossfadeTo(vowel) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const old = this.source;
    const oldGain = this.gain;

    const newGain = this.ctx.createGain();
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + FADE_SEC);
    newGain.connect(this.ctx.destination);

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(vowel);
    src.loop = true;
    src.connect(newGain);
    src.start(now);

    if (old && oldGain) {
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + FADE_SEC);
      try { old.stop(now + FADE_SEC + 0.01); } catch (e) {}
    }

    this.source = src;
    this.gain = newGain;
    // master gain applied on newGain
    newGain.gain.cancelScheduledValues(now);
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(this.masterGain, now + FADE_SEC);
  }

  start(vowel = "A") {
    if (this.running) return;
    this.currentVowel = vowel;
    this.running = true;
    const now = this.ctx.currentTime;
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(this.masterGain, now + FADE_SEC);
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffers.get(vowel);
    this.source.loop = true;
    this.source.connect(this.gain);
    this.source.start(now);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + FADE_SEC);
    try { this.source.stop(now + FADE_SEC + 0.01); } catch (e) {}
    this.source = null;
  }

  setMasterGain(g) {
    this.masterGain = g;
    if (this.gain && this.running) this.gain.gain.linearRampToValueAtTime(g, this.ctx.currentTime + 0.05);
  }
}
