# Manipura — Архитектура

> Детальная архитектура Manipura (Telegram Mini App). Дополняет `README.md` (обзор) и `docs/ENGINE.md`/`AUDIO.md`/`IMU.md` (детали слоёв).
> Дата: 2026-11-12. Автор: Чат 413 (хаб), по отчёту 413b.

## 1. Что это

Manipura — Telegram Mini App QONVERSE. Управление гласными через наклон телефона (IMU). Отдельный репо, отдельный WASM, отдельный интерфейс. Отдаёт в эфир **звук**, не данные (обход Web Bluetooth iOS).

## 2. Слои (снизу вверх)

```
┌─────────────────────────────────────────────┐
│ UI (app.js): 2D-крест, кнопки, readout       │
│   canvas-рендер, DeviceOrientation handler   │
├─────────────────────────────────────────────┤
│ IMU (app.js): beta, gamma -> weightsFromIMU  │
│   DeviceOrientationEvent.requestPermission() │
├─────────────────────────────────────────────┤
│ Audio (audio.js): 5-voice mix                │
│   AudioBufferSourceNode x4 + OscillatorNode  │
│   GainNode x5 + master, 20 мс ramp           │
├─────────────────────────────────────────────┤
│ Engine (wasm.js): manipura.wasm (32 KB)      │
│   _manipura_synth_* (11 экспортов)           │
├─────────────────────────────────────────────┤
│ C++ (generator/, 1:1 из prism/generator/)    │
│   Presets.h (STD-пресеты), HarmonicSynth.h   │
│   Emscripten 6.0.12 -> manipura.wasm         │
└─────────────────────────────────────────────┘
```

**Границы:**
- `generator/` — скопирован 1:1 из `prism/generator/`. Оригинал не изменён. Правки — только в PRISM (зона 413a), не здесь.
- `wasm/` — обёртка, только синтез (анализатор отрезан).
- `js/` — Manipura-специфика (audio, IMU, UI).
- `docs/` — документация.

## 3. Потоки данных

### 3.1. IMU -> звук

```
deviceorientation (beta, gamma)   ~60 Гц
   │
   ▼
weightsFromIMU(beta, gamma)   -> {A, O, U, E, C}, сумма = 1.0
   │
   ▼
audio.setWeights(w)   -> GainNode linearRamp (20 мс)
   │
   ▼
5-voice mix (AudioBufferSourceNode x4 + OscillatorNode)
   │
   ▼
master GainNode (0.5) -> destination (AirPods/динамик/провод)
```

### 3.2. Запуск (порядок)

1. `Start Sound` (user gesture) -> `AudioContext.resume()`, создание 4 буферов + осциллятора.
2. `Enable Orientation` (user gesture) -> `DeviceOrientationEvent.requestPermission()` -> `allow`.
3. С этого момента `deviceorientation` приходит, `weightsFromIMU` обновляет веса.

**Почему этот порядок:** iOS требует user gesture и для `AudioContext`, и для `requestPermission()`. Кнопки — единственный надёжный способ.

## 4. API (слои)

### 4.1. WASM (`wasm.js`)

- `loadEngine()` -> Promise<Module> — грузит `manipura.js`.
- `renderVowel(M, vowel, n, sr, opts)` -> Float32Array — PCM для одной гласной.
- `VOWEL = {A:0, O:1, U:2, Y:3, I:4, E:5}`, `PRESET = {STD:0, MY:1, HYB:2}`.

### 4.2. Audio (`audio.js`)

- `new ManipuraAudio()` — конструктор.
- `async init()` — AudioContext, 4 буфера, осциллятор, нормализация (peak -> 0.9).
- `start(weights)` — master ramp до 0.5, запуск источников.
- `stop()` — master ramp до 0.
- `setWeights(w)` — 5 GainNode linearRamp 20 мс.
- `setMasterGain(g)` — общая громкость.
- `weightsFromIMU(beta, gamma)` -> `{A, O, U, E, C}` — 2D-крест.

### 4.3. UI (`app.js`)

- `draw()` — canvas-рендер (7 слоёв: ring, ticks, cross, 4 letters, C, dot, line).
- `onOrientation(e)` — IMU handler.
- `enableOrientation()` — iOS permission.
- `toggleSound()` — Start/Stop.

## 5. Ключевые решения

1. **Отдельный репо, не ветка `prism`.** Модульность QONVERSE.
2. **Отдельный WASM (`manipura.wasm` 32 KB), не `prism_analyzer.wasm` 76 KB.** Не тащим анализатор.
3. **Обход Web Bluetooth iOS через звук.** Apple блокирует Web Bluetooth в WKWebView, аудио работает.
4. **Без AudioWorklet.** `AudioBufferSourceNode` надёжен везде (Safari/Telegram WebView). Минус — нет сэмпл-точной модуляции, но для IMU (60 Гц) не нужно.
5. **2D-крест, не 6 секторов.** Экран параллелен горизонту, наклоны от плоскости, морфинг от центра. Центр — только F0.
6. **Не чинить клиппинг PRISM в C++.** Нормализация в JS (`audio.js`). `generator/` — общий с PRISM.

## 6. Границы (что не делает)

- Не анализирует звук (это Receiver, 413a).
- Не отправляет данные в сеть (только звук в эфир).
- Не трогает `prism/` (кроме копии `generator/`).
- Не трогает `sqore/`.
- Не форкает OJD/DFS.

## 7. Ссылки

- `README.md` — обзор, структура, сборка.
- `docs/ENGINE.md` — WASM-движок: формулы, параметры, API.
- `docs/AUDIO.md` — 5-voice mix, `weightsFromIMU`, нормализация.
- `docs/IMU.md` — DeviceOrientation, beta/gamma/alpha.
- `docs/RECEIVER.md` — для 413a: приём, эталоны, MIDI CC.
- `docs/JOURNAL.md` — история решений.
- `docs/STATUS.md` — что работает, что нет.
- `docs/HISTORY.md` — хронология сессии.
- `meta/docs/SESSION_413.md` — общий отчёт фазы 413.
- `prism/docs/MANIPURA.md` — идея модуля.
- `prism/generator/Presets.h` — источник STD-пресетов.

---

Дата: 2026-11-12. Автор: Чат 413 (хаб).
