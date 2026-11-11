# Manipura — Journal

> Хронология решений. Каждый шаг — дата, что, почему, какие баги были.
> Дополняет `prism/docs/JOURNAL.md` (2.37) — здесь только про Manipura.

## 2026-11-11 — рождение репозитория

- Создан `github.com/GuardianOfDreams/manipura` (пустой README, `7f29dc5`)
- Локально: `~/qrealab-workspace/projects/qonverse/manipura/`
- Ветка `main`

## 2026-11-11 — STD-пресеты (данные)

- **Источник:** `prism/generator/Presets.h` (строки 38–77)
- **Скопировано:** 5 спек (A, O, Y, I, E) + ручной `kStdU[64]`
- **Формат:** `std-presets.js` (ES-модуль, константы)
- **Проверка:** `kNumHarmonics=64`, `STD_U.length=64`, 5 спек по 5/5
- **Коммит:** `334b401`

## 2026-11-11 — STD-логика (gains)

- **Источник:** `prism/generator/Presets.h:157-173` (computeStdGains) и `HarmonicSynth.h:135-147,83-91` (applyInvariants, getFinalGains)
- **Скопировано:** `std-gains.js` — `stdGains`, `applyInvariants`, `getFinalGains`, `stdChain`
- **Проверка на числах:** 6 гласных, `len=64`, `H1=1.0`, U без инвариантов, U tail=0
- **Коммит:** `25a3489`
- **Замечание:** эти JS-файлы остаются как **эталон/референс**. Финальный движок — WASM (ниже).

## 2026-11-11 — UI-каркас (canvas + IMU)

- `index.html` + `css/manipura.css` + `js/app.js`
- 6 секторов гласных, тики, точка наклона
- `DeviceOrientation.requestPermission()` для iOS 13+
- **Коммит:** `636bc38`
- **Баги, исправлены по ходу:**
  1. `getContext(2d)` → `getContext("'2d'")` (без кавычек — SyntaxError)
  2. `ctx.font` — двойное экранирование в `printf` дало битую строку
  3. `import "./std-gains.js"` → `"../std-gains.js"` (файл в корне, не в js/)

## 2026-11-11 — отдельный WASM-движок

- **Решение:** отдельный `manipura.wasm`, не `prism_analyzer.wasm`
- **Что скопировано из PRISM:** `generator/` (header-only) + `wasm/` (build.sh, CMakeLists, wrapper)
- **Что отрезано:** анализатор (LPC, кепстр, SVM, TunerClassifier, Pitch) — только синтез
- **Экспорты:** `_manipura_synth_*` (init, set_preset, set_f0, set_fwidth, set_h1_boost, get_gains, render, render_block, reset_phase, morph)
- **Сборка:** `emcc 6.0.12`, `-sENVIRONMENT=web,worker,node`
- **Размер:** `manipura.wasm` 32 KB (vs 76 KB `prism_analyzer.wasm`)
- **Проверка:** 9 экспортов, `gains[0..7]` 1:1 с JS, `render` даёт PCM
- **Коммит:** `d6302d0`
- **Баги, исправлены по ходу:**
  1. `-sENVIRONMENT=web,worker` → `web,worker,node` (Node отказывался грузить)

## 2026-11-11 — аудио-цепочка (AudioBufferSourceNode)

- **Решение:** без AudioWorklet (риски `fetch`/`importScripts` на iOS/Telegram WebView)
- **Что:** `AudioBufferSourceNode` × 4 (A,O,U,E) + `OscillatorNode` (центр C) + `GainNode` × 5 + master
- **Нормализация:** per-vowel peak → 0.9 (баг PRISM: клиппинг A 1.64, E 1.46, O 1.63, I 1.06, U 1.07; Y 0.58 — ок)
- **Кроссфейд:** 20 мс linear ramp при смене весов
- **Коммиты:** `d6302d0` (исходная аудио), `16f665c` (5-voice mix)

## 2026-11-11 — 2D-крест (4 стороны + центр)

- **Задача от Александра:** «экран всегда параллелен горизонту, 4 стороны, морфинг от центра»
- **Семантика:**
  - центр (beta=0, gamma=0) → C (только F0 100 Hz)
  - beta < 0 (перед) → U; beta > 0 (зад) → O
  - gamma < 0 (лево) → A; gamma > 0 (право) → E
- **Формула:** `weightsFromIMU(beta, gamma)` — 5 весов, сумма = 1.0 (см. `docs/AUDIO.md` §3)
- **Проверка:** 10 кейсов, сумма 1.00 везде, диагонали дают 0.5+0.5
- **UI:** 2D-крест (U сверху, E справа, O снизу, A слева, C в центре если > 0.5)
- **Коммит:** `16f665c`
- **Тест на iPhone (Telegram):** работает. Гласные меняются, гироскоп работает, интерфейс приятный.

## 2026-11-11 — карточка на титуле QALIMBA

- **Задача:** Александр хочет открывать Manipura с титульного листа QALIMBA в Telegram, а не по прямой ссылке
- **Где:** `qalimba/index.html`, после PRISM, перед footer
- **Разметка:** `<a class="choice">` с `choice-title` = MANIPURA, `choice-desc`, `choice-tag` = motion
- **Ссылка:** `https://guardianofdreams.github.io/manipura/` (пока GitHub Pages)
- **Коммит:** `qalimba` `dd7f560`

## 2026-11-11 — документация

- `docs/ENGINE.md` — WASM, формулы, параметры, API
- `docs/AUDIO.md` — 5-voice mix, weightsFromIMU, нормализация
- `docs/IMU.md` — DeviceOrientation, beta/gamma/alpha, как держать телефон
- `docs/RECEIVER.md` — для 413a: что принимать, эталоны, распознавание
- `docs/JOURNAL.md` — этот файл

## Открытые вопросы

1. **F0** — жёстко 100 Hz. Следующий шаг: F0 от отдельной оси/жеста
2. **Полифония** — сейчас один наклон. Несколько касаний — будущее
3. **Cloudflare vs GitHub Pages** — сейчас GitHub Pages. Cloudflare — когда договоримся
4. **Калибровка AirPods** — может вносить задержку и DSP-искажения. Проверить на приёмнике
5. **Y и I** — в движке есть, в UI не используются. Вернуть? — по желанию

## Ссылки

- `prism/docs/JOURNAL.md` 2.37 — запись про Manipura
- `prism/docs/MANIPURA.md` — общая идея модуля
- `prism/docs/TUNER.md` — эталоны r1/r2 (для 413a)
