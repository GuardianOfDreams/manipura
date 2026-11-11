# Manipura

> Telegram Mini App. Управление гласными через IMU (наклон телефона).
> Отдельный WASM-движок. Отдельный интерфейс. Отдельная карточка на титуле QALIMBA.

## Что это

**Manipura** — модуль QONVERSE, обходит Web Bluetooth iOS через звук.
Пользователь наклоняет телефон → меняется гласная (A, O, U, E + центр) → звук уходит в воздух/провод/AirPods → Mac/PC принимает и распознаёт.

```
[iPhone, Telegram]                            [Mac/PC]
     Manipura  ──── звук (AirPods/динамик/провод) ────►  приёмник
     (WASM)                                            (LPC + TunerClassifier)
          │                                                  │
          ▼                                                  ▼
     наклон IMU → 4 гласные + F0                     4 канала → MIDI CC → джойстик
```

## Демо

**GitHub Pages:** https://guardianofdreams.github.io/manipura/
**Титул QALIMBA (Telegram):** `@qalimba_bot` → карточка MANIPURA

## Как пользоваться

1. Открыть в Telegram: титул QALIMBA → MANIPURA
2. Нажать **Start Sound** (тон 100 Hz)
3. Нажать **Enable Orientation** → Allow
4. Наклонять телефон:
   - **центр** — только тон (F0)
   - **влево** → A, **вправо** → E
   - **вперёд** → U, **назад** → O
   - **диагональ** → смесь

## Структура репозитория

```
manipura/
├── index.html              # точка входа
├── css/manipura.css        # тёмная янтарная тема
├── js/
│   ├── wasm.js             # loadEngine, renderVowel
│   ├── audio.js            # 5-voice mix + weightsFromIMU
│   └── app.js              # UI + IMU
├── wasm/
│   ├── wasm_wrapper.cpp    # _manipura_synth_* экспорты
│   ├── CMakeLists.txt
│   ├── build.sh
│   └── build/
│       ├── manipura.js     # 38 KB (glue, tracked)
│       └── manipura.wasm   # 32 KB (движок, tracked)
├── generator/              # скопировано из prism/generator (1:1)
│   ├── Presets.h
│   ├── HarmonicSynth.h
│   └── CMakeLists.txt
├── std-presets.js          # JS-эталон данных (референс, не используется в рантайме)
├── std-gains.js            # JS-эталон логики (референс)
└── docs/
    ├── ENGINE.md           # WASM-движок: формулы, параметры, API
    ├── AUDIO.md            # аудио-цепочка, weightsFromIMU, нормализация
    ├── IMU.md              # DeviceOrientation, что приходит, как читать
    ├── RECEIVER.md         # для 413a: приём, эталоны, распознавание
    └── JOURNAL.md          # история решений
```

## Сборка WASM

```bash
cd ~/qrealab-workspace/projects/qonverse/manipura
bash wasm/build.sh
```

Требует Emscripten (`emcc`). Результат: `wasm/build/manipura.js` + `.wasm`.

## Документация

- [ENGINE.md](docs/ENGINE.md) — движок: 64 гармоники, STD-пресеты, формулы
- [AUDIO.md](docs/AUDIO.md) — 5-voice mix, `weightsFromIMU`, нормализация
- [IMU.md](docs/IMU.md) — DeviceOrientation, beta/gamma/alpha
- [RECEIVER.md](docs/RECEIVER.md) — **для 413a**: приём, эталоны r1/r2, MIDI CC
- [JOURNAL.md](docs/JOURNAL.md) — история решений

## Связь

- **Титул QONVERSE:** `qalimba/index.html` (карточка MANIPURA)
- **PRISM:** `prism/docs/MANIPURA.md` (идея), `prism/docs/TUNER.md` (эталоны)
- **Методология:** `meta/docs/METHODOLOGY.md` (фаза 413, роль 413b)
- **Стек:** `meta/docs/STACK.md`
- **Модули:** `meta/docs/MODULES.md`

## Статус

- ✅ WASM-движок (отдельный, 32 KB)
- ✅ 5-voice mix (A, O, U, E + центр F0)
- ✅ 2D-крест IMU (beta, gamma) с морфингом
- ✅ Карточка на титуле QALIMBA
- ✅ Документация (ENGINE, AUDIO, IMU, RECEIVER, JOURNAL)
- 🟡 Хостинг: GitHub Pages (Cloudflare — когда договоримся)
- ⚪ F0-слайдер (сейчас 100 Hz жёстко)
- ⚪ Полифония (несколько касаний)
- ⚪ Приёмник (413a)

## Разработка

Роль: **чат 413b** (Mini App, PRISM, Manipura).
Ветка: `main` (пока один разработчик).
Правила: `meta/docs/METHODOLOGY.md` §2.
