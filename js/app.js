// Manipura — 413b. 2D cross: center = pure F0, edges = vowels.
// front(U) / back(O) / left(A) / right(E), intensity by tilt magnitude.

import { ManipuraAudio, weightsFromIMU } from './audio.js';

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

function dominantLabel(w) {
  let best = "—", val = 0;
  for (const k of ["A","O","U","E"]) { if (w[k] > val) { val = w[k]; best = k; } }
  if (val < 0.05) return "C";
  return best + " " + Math.round(val*100) + "%";
}

function draw() {
  const w = el.canvas.width / state.dpr;
  const h = el.canvas.height / state.dpr;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.4;

  ctx.clearRect(0, 0, w, h);

  // outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#3a2610";
  ctx.lineWidth = 1;
  ctx.stroke();

  // ticks
  ctx.strokeStyle = "#8a6a2e";
  for (let d = 0; d < 360; d += 10) {
    const a = (d - 90) * Math.PI / 180;
    const inner = r - (d % 30 === 0 ? 8 : 4);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }

  // cross axes
  ctx.strokeStyle = "rgba(255, 207, 107, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

  // 4 cardinal labels: U top, O bottom, A left, E right
  const labels = [ { t: "U", dx: 0, dy: -1 }, { t: "E", dx: 1, dy: 0 }, { t: "O", dx: 0, dy: 1 }, { t: "A", dx: -1, dy: 0 } ];
  const wts = weightsFromIMU(state.beta, state.gamma);
  const maxW = Math.max(wts.A, wts.O, wts.U, wts.E);
  for (const L of labels) {
    const lx = cx + L.dx * (r - 34);
    const ly = cy + L.dy * (r - 34);
    const active = state.hasOrientation && maxW > 0.1 && wts[L.t] >= maxW * 0.95;
    ctx.fillStyle = active ? "#ff8c1a" : "#8a6a2e";
    ctx.font = "600 22px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(L.t, lx, ly);
  }

  // center marker C
  if (state.hasOrientation && wts.C > 0.5) {
    ctx.fillStyle = "#ffcf6b";
    ctx.font = "600 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("C", cx, cy + 24);
  }

  // tilt dot (respects magnitude, clamped to r)
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
    ctx.arc(px, py, 8, 0, Math.PI * 2);
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
  const w = weightsFromIMU(state.beta, state.gamma);
  el.vowel.textContent = state.hasOrientation ? dominantLabel(w) : "—";
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
  if (audioReady) audio.setWeights(weightsFromIMU(state.beta, state.gamma));
}

async function enableOrientation() {
  if (typeof DeviceOrientationEvent === "undefined") {
    setStatus("DeviceOrientation не поддерживается");
    return;
  }
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") { setStatus("Доступ не разрешён"); return; }
    } catch (err) {
      setStatus("Ошибка: " + err.message);
      return;
    }
  }
  window.addEventListener("deviceorientation", onOrientation, true);
  el.btnOrient.disabled = true;
  el.btnOrient.textContent = "Orientation ON";
  setStatus("Ориентация включена. Наклоняй.");
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
      audio.start(weightsFromIMU(state.beta, state.gamma));
      el.btnSound.textContent = "Stop Sound";
      el.btnSound.disabled = false;
      setStatus("Звук включён. Только F0 в центре, гласные по краям.");
    } catch (err) {
      el.btnSound.textContent = "Start Sound";
      el.btnSound.disabled = false;
      setStatus("Ошибка: " + err.message);
    }
    return;
  }
  if (audio.running) {
    audio.stop();
    el.btnSound.textContent = "Start Sound";
    setStatus("Звук выключен.");
  } else {
    await audio.resume();
    audio.start(weightsFromIMU(state.beta, state.gamma));
    el.btnSound.textContent = "Stop Sound";
    setStatus("Звук включён.");
  }
}

function init() {
  el.btnSound.addEventListener("click", toggleSound);
  el.btnOrient.addEventListener("click", enableOrientation);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  if (typeof DeviceOrientationEvent === "undefined") el.btnOrient.disabled = true;
  resizeCanvas();
  setStatus("Start Sound → Enable Orientation → наклоняй");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
