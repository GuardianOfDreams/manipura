// Manipura — 413b. Canvas scales + DeviceOrientation + sound (WASM).

import { ManipuraAudio } from './audio.js';

const VOWELS = ['A', 'O', 'U', 'Y', 'I', 'E'];

const el = {
  canvas: document.getElementById('mp-canvas'),
  vowel: document.getElementById('ro-vowel'),
  alpha: document.getElementById('ro-alpha'),
  tilt: document.getElementById('ro-tilt'),
  btnSound: document.getElementById('btn-sound'),
  btnOrient: document.getElementById('btn-orient'),
  status: document.getElementById('status')
};

const ctx = el.canvas.getContext('2d');
const state = {
  beta: 0, gamma: 0, alpha: 0,
  hasOrientation: false,
  dpr: Math.min(window.devicePixelRatio || 1, 2)
};

let audio = null;
let audioReady = false;

function setStatus(msg) { el.status.textContent = msg; }

function resizeCanvas() {
  const rect = el.canvas.getBoundingClientRect();
  const w = rect.width || 360;
  const h = rect.height || 360;
  el.canvas.width = Math.round(w * state.dpr);
  el.canvas.height = Math.round(h * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  draw();
}

function gammaToVowelIndex(gamma) {
  const c = Math.max(-90, Math.min(90, gamma));
  const norm = (c + 90) / 180;
  const idx = Math.floor(norm * VOWELS.length);
  return Math.min(VOWELS.length - 1, Math.max(0, idx));
}

function draw() {
  const w = el.canvas.width / state.dpr;
  const h = el.canvas.height / state.dpr;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.4;

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#3a2610";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "#8a6a2e";
  for (let d = 0; d < 360; d += 10) {
    const a = (d - 90) * Math.PI / 180;
    const inner = r - (d % 30 === 0 ? 8 : 4);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }

  const activeIdx = gammaToVowelIndex(state.gamma);
  const sector = Math.PI * 2 / VOWELS.length;
  for (let i = 0; i < VOWELS.length; i++) {
    const start = -Math.PI / 2 + i * sector;
    const end = start + sector;
    const isActive = i === activeIdx && state.hasOrientation;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 14, start, end);
    ctx.closePath();
    ctx.fillStyle = isActive ? "rgba(255, 140, 26, 0.25)" : "rgba(255, 207, 107, 0.04)";
    ctx.fill();
    const mid = start + sector / 2;
    const lx = cx + Math.cos(mid) * (r - 34);
    const ly = cy + Math.sin(mid) * (r - 34);
    ctx.fillStyle = isActive ? "#ff8c1a" : "#8a6a2e";
    ctx.font = "600 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(VOWELS[i], lx, ly);
  }

  if (state.hasOrientation) {
    const maxR = r - 20;
    const gx = Math.max(-1, Math.min(1, state.gamma / 90));
    const gy = Math.max(-1, Math.min(1, state.beta / 90));
    const px = cx + gx * maxR;
    const py = cy + gy * maxR;
    ctx.strokeStyle = "rgba(255, 140, 26, 0.3)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8c1a";
    ctx.fill();
    ctx.strokeStyle = "#ffcf6b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#8a6a2e";
    ctx.fill();
  }
}

function updateReadouts() {
  const idx = gammaToVowelIndex(state.gamma);
  el.vowel.textContent = state.hasOrientation ? VOWELS[idx] : "—";
  el.alpha.textContent = state.hasOrientation ? Math.round(state.alpha) + "°" : "—";
  el.tilt.textContent = state.hasOrientation
    ? Math.round(state.beta) + "/" + Math.round(state.gamma)
    : "—";
}

function onOrientation(e) {
  if (e.beta === null && e.gamma === null && e.alpha === null) return;
  state.beta = e.beta || 0;
  state.gamma = e.gamma || 0;
  state.alpha = e.alpha || 0;
  state.hasOrientation = true;
  updateReadouts();
  draw();
  if (audioReady) {
    const idx = gammaToVowelIndex(state.gamma);
    audio.setVowel(VOWELS[idx]);
  }
}

async function enableOrientation() {
  if (typeof DeviceOrientationEvent === "undefined") {
    setStatus("DeviceOrientation не поддерживается");
    return;
  }
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") { setStatus("Доступ к ориентации не разрешён"); return; }
    } catch (err) {
      setStatus("Ошибка запроса: " + err.message);
      return;
    }
  }
  window.addEventListener("deviceorientation", onOrientation, true);
  el.btnOrient.disabled = true;
  el.btnOrient.textContent = "Orientation ON";
  setStatus("Ориентация включена. Наклоняй устройство.");
}

async function toggleSound() {
  if (!audio) {
    el.btnSound.disabled = true;
    el.btnSound.textContent = "Loading…";
    try {
      audio = new ManipuraAudio();
      await audio.init();
      await audio.resume();
      audioReady = true;
      const idx = state.hasOrientation ? gammaToVowelIndex(state.gamma) : 0;
      audio.start(VOWELS[idx]);
      el.btnSound.textContent = "Stop Sound";
      el.btnSound.disabled = false;
      setStatus("Звук включён. Наклоняй — гласная меняется.");
    } catch (err) {
      el.btnSound.textContent = "Start Sound";
      el.btnSound.disabled = false;
      setStatus("Ошибка звука: " + err.message);
    }
    return;
  }
  if (audio.running) {
    audio.stop();
    el.btnSound.textContent = "Start Sound";
    setStatus("Звук выключен.");
  } else {
    await audio.resume();
    const idx = state.hasOrientation ? gammaToVowelIndex(state.gamma) : 0;
    audio.start(VOWELS[idx]);
    el.btnSound.textContent = "Stop Sound";
    setStatus("Звук включён.");
  }
}

function init() {
  el.btnSound.addEventListener("click", toggleSound);
  el.btnOrient.addEventListener("click", enableOrientation);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  if (typeof DeviceOrientationEvent === "undefined") {
    el.btnOrient.disabled = true;
  }
  resizeCanvas();
  setStatus("Start Sound → Enable Orientation → наклоняй");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
