# Manipura — История сессии

> Развёрнутая хронология сессии 413b (2026-11-11). Дополняет `docs/JOURNAL.md` (там короткие записи по решениям).
> Дата: 2026-11-12. Автор: Чат 413 (хаб), по отчёту 413b.

## Шаг 0. Чтение и проверка состояния

**Зачем:** по методологии 413b начинает с чтения bootstrap + methodology + git status.

**Что нашли:**
- `BOOTSTRAP_413.md` (141 строка) — §1.3: web/manipura.html создать; §1.5: qalimba карточки; §5: Manipura MVP — первый приоритет.
- `METHODOLOGY.md` (117 строк) — §3.2: 413b = prism/web/; §3.5: ветка 413b = feature/manipura.
- `STACK.md` (168 строк) — Vanilla JS, HTML5 Canvas, Web Audio API, AudioWorklet, Pointer Events, Cloudflare Pages.
- `MODULES.md` (152 строки) — Manipura в prism, статус 🆕 ресерч.
- `MANIPURA.md` (89 строк) — M.1–M.7.
- `git status`: ветка `feature/beatbox`, HEAD `c6c788d`, чисто.

**Флаг:** ветка не та (должна быть `feature/manipura`). Предложил создать от `feature/beatbox` (там актуальное).

## Шаг 1. Новый репозиторий (решение Александра)

**Зачем:** Александр решил: отдельный репозиторий `manipura`, не ветка `prism`. Архитектурно правильно (модульность QONVERSE).

**Что сделано:**
- `mkdir ~/qrealab-workspace/projects/qonverse/manipura`
- `git init -b main`
- README (12 строк, минимум)
- `gh repo create GuardianOfDreams/manipura --public --source=. --remote=origin --push`
- Коммит `7f29dc5` «chore: bootstrap manipura repo»

## Шаг 2. Поиск и перенос STD-пресетов (факты, не гипотезы)

**Зачем:** найти, где лежат STD-пресеты (6 гласных), прочитать, подготовить план переноса.

**Что нашли (`find`):**
- `prism/generator/Presets.h` — гипотеза из документов подтверждена
- `prism/tools/my_voice_presets.json` — MY-пресеты
- `prism/web/my_voice_presets.json` — копия
- `prism/tools/fix_presets.py` — скрипт

**Что прочитали (`Presets.h`, 175 строк):**
- `kNumHarmonics = 64` (стр. 28)
- `StdFormantSpec { freqs[5], amps[5] }` (стр. 33–36)
- 5 спек: A (38–41), O (43–46), Y (48–51), I (53–56), E (58–61)
- U — ручной массив `kStdU[64]` (67–77)
- Формула `computeStdGains` (157–173): гаусс + H1=1.0

**Параметры (из `HarmonicSynth.h`):**
- `f0 = 100.0` (стр. 17)
- `fwidth = 0.08` (стр. 19)
- `h1Boost = 1.0` (стр. 18)

**Итог:** полный план переноса — 5 шагов (данные -> gains -> инварианты -> H1 Boost -> проверка 1:1).

## Шаг 3. Каркас UI (canvas + IMU)

**Зачем:** по роли 413b — `manipura.html` + css + js, canvas-шкалы + DeviceOrientation, без синтеза.

**Что сделали:**
- `index.html` — canvas 360×360, readout (VOWEL/ORIENT/TILT), кнопка Enable Orientation
- `css/manipura.css` — янтарная тема, safe-area, grid readout
- `js/app.js` — IIFE, canvas-рендер (кольцо, тики, 6 секторов, индикатор наклона), `DeviceOrientationEvent.requestPermission()` для iOS 13+

**Баги (исправлены):**
1. `getContext(2d)` -> `getContext('2d')` (без кавычек — SyntaxError)
2. `ctx.font` — двойное экранирование printf -> битая строка
3. `import './std-gains.js'` -> `'../std-gains.js'` (файлы в корне, не в js/)

**Проверка:** Node smoke test — синтаксис валиден.

## Шаг 4. Отдельный WASM-движок

**Зачем:** Александр потребовал отдельный WASM, не `prism_analyzer.wasm`. Код можно подсмотреть/скопировать из PRISM.

**Что скопировали из PRISM:**
- `generator/` (header-only: `Presets.h`, `HarmonicSynth.h`, `CMakeLists.txt`) — 1:1
- `wasm/` (`build.sh`, `CMakeLists.txt`, `wasm_wrapper.cpp`) — с правками

**Что отрезали:**
- Анализатор: `analyzer/Pitch.h`, `core/FormantEstimator.h`, `analyzer/Tuner.h`, `core/RatioMapper.h`, `core/SVMClassifier.h`, `core/ColorMixer.h` — не нужны для Manipura (только синтез).

**Что переписали:**
- `wasm/CMakeLists.txt`: `-sENVIRONMENT=web,worker,node`, `-sEXPORT_NAME=Manipura`, output `manipura.js`/`manipura.wasm`, экспорты `_manipura_synth_*`
- `wasm/wasm_wrapper.cpp`: только synth, 11 экспортов

**Сборка:**
- `emcc 6.0.12`
- `manipura.js`: 38 180 байт
- `manipura.wasm`: 32 642 байт (vs 76 988 у `prism_analyzer.wasm` — вдвое меньше)

**Проверка (Node):**
- 9 экспортов -> function
- `gains[0..7]` для A: 1.000, 0.150, 0.010, 0.010, 0.012, 0.300, 1.000, 0.300 — 1:1 с JS-эталоном
- `render(4800)` -> peak=1.6393, rms=0.3782 — клиппинг! (баг PRISM)

**Баги (исправлены):**
1. `-sENVIRONMENT=web,worker` -> `web,worker,node` (Node отказывался грузить)

**Известный баг PRISM (не чинил, границы):**
- `HarmonicSynth.h:121` — `sample * 0.2` без нормализации. 64 гармоники с gains до 1.0 дают пик до 1.64. Не чинил, потому что это C++ PRISM (зона 413a).

## Шаг 5. Аудио-цепочка

**Зачем:** нужно, чтобы звук шёл из браузера. Александр: «делай как качественно, итеративно, сначала должна заработать надёжно вся цепочка».

**Решение:** без AudioWorklet (риски fetch/importScripts в Safari/Telegram WebView). Использовать `AudioBufferSourceNode` (надёжно везде).

**Что сделали:**
- `js/wasm.js` — обёртка `loadEngine()`, `renderVowel()`
- `js/audio.js` — класс `ManipuraAudio`: 4 × `AudioBufferSourceNode` (A, O, U, E, loop 1s), 1 × `OscillatorNode` (sine 100 Hz, центр), 5 × `GainNode` (веса) + master `GainNode` (0.5)
- Нормализация per-vowel peak -> 0.9 (фикс клиппинга PRISM)
- Сглаживание весов: 20 мс linear ramp
- `js/app.js` — обновлён: Start Sound кнопка, `audio.setVowel()` на IMU

**Нормализация:**
- A: raw 1.639 -> 0.549
- O: 1.625 -> 0.554
- U: 1.067 -> 0.843
- E: 1.458 -> 0.617

**Проверка:** пики до 0.9, без клиппинга.

## Шаг 6. 2D-крест (4 стороны + центр)

**Зачем:** Александр уточнил: «экран всегда параллелен горизонту, 4 стороны света, морфинг от центра. Центр = только основной тон, без формант».

**Формула `weightsFromIMU(beta, gamma)` (`js/audio.js:145–153`):**
```js
a = max(0, -gamma/90)   // left
e = max(0,  gamma/90)   // right
u = max(0, -beta/90)    // front
o = max(0,  beta/90)    // back
sum = a + e + u + o
if sum <= 1: { A:a, O:o, U:u, E:e, C: 1-sum }
else:        { A:a/sum, O:o/sum, U:u/sum, E:e/sum, C: 0 }
```

**Что сделали:**
- `js/audio.js` -> 5-voice mix (4 buffer + 1 osc)
- `js/app.js` -> 2D-крест (U top, E right, O bottom, A left, C в центре если > 0.5)
- `js/wasm.js` -> `VOWEL_KEYS_UI = ['A','O','U','E']`
- `index.html` -> кнопка Start Sound (дедуп после бага с sed)

**Баги (исправлены):**
- Дубли `btn-sound` (sed + python сработали дважды) -> дедуп через python replace

**Проверка:** 10 кейсов `weightsFromIMU`, сумма всегда 1.00. Тест на iPhone: работает. Подтверждено Александром.

## Шаг 7. Карточка на титуле QALIMBA

**Зачем:** Александр: «мне нужно чтобы у меня в телеге на титульном листе в калимбе появился отдельный модуль манипура».

**Что сделали:**
- `qalimba/index.html` — вставили `<a class="choice">` с MANIPURA после PRISM, перед footer
- Ссылка: `https://guardianofdreams.github.io/manipura/`
- Коммит в `qalimba`: `dd7f560`

## Шаг 8. Документация

**Зачем:** Александр: «зафиксировать результаты, заполнить и создать документацию, залить закоммитить запушить, дать отчёт для 413».

**Что создали (5 файлов, 596 строк):**
- `docs/ENGINE.md` (113 строк) — WASM-движок: 64 гармоники, STD-пресеты, формулы, API, сборка
- `docs/AUDIO.md` (121 строка) — 5-voice mix, `weightsFromIMU`, нормализация, схема
- `docs/IMU.md` (105 строк) — DeviceOrientation, beta/gamma/alpha, как держать телефон, API
- `docs/RECEIVER.md` (156 строк) — для 413a: что принимать, эталоны r1/r2, MIDI CC, что копировать из PRISM
- `docs/JOURNAL.md` (101 строка) — история решений, баги, открытые вопросы
- `README.md` (108 строк) — структура репо, демо, сборка, документация, статус

**Коммит:** `a5c4f68`.

## Шаг 9. Взаимодействие с 413a (приёмник)

**Зачем:** 413a строит приёмник. Им нужны точные параметры сигнала.

**Их вопросы:** точные шаблоны S_i (64-мерные), частота обновления весов, центр C, диапазон весов, где смотреть код, контекст.

**Мои ответы:**
- Шаблоны: формула `Presets.h:157–173`, спеки `:38–61`, U `:67–77`. Финальные в эфире = `S_i * normalize_i * 0.2 * 0.5`. `normalize_A=0.549, O=0.554, U=0.843, E=0.617`.
- Частота: `weightsFromIMU` ~60 Гц. Сглаживание — linear ramp 20 мс в `GainNode`. IMU не сглаживается.
- Центр C: синус 100 Гц, только H1. В эфире `weight_C * 0.5`. Вычитается из других (сумма = 1.0).
- Диапазон: веса ∈ [0,1], сумма точно 1.0. Рекомендация: FFT 2048 (42.7 мс, 23.4 Гц разрешение).
- Код: карта файлов с номерами строк.

**Их следующий вопрос (Шаг 4c):** нужно 1:1 повторить UI в JUCE.

**Мои ответы:** 7 слоёв, точные цвета (bg `#1a0f00`, fg `#ffcf6b`, accent `#ff8c1a`, dim `#8a6a2e`, line `#3a2610`). Точка — `arc(r=8)`, fill accent, stroke fg, lineWidth 1.5. Сырые `gamma/90`, `beta/90`. НЕ из весов.

## Итог

Manipura MVP работает в Telegram на iPhone. 9 коммитов, 596 строк документации (плюс ARCHITECTURE 125, STATUS 109, HISTORY — этот). Передано 413a: шаблоны, формула весов, частоты, рекомендация FFT 2048.

## Ссылки

- `docs/JOURNAL.md` — короткие записи по решениям.
- `docs/STATUS.md` — что работает, что нет, метрики.
- `docs/ARCHITECTURE.md` — детальная архитектура.
- `meta/docs/SESSION_413.md` — общий отчёт фазы 413.

---

Дата: 2026-11-12. Автор: Чат 413 (хаб).
