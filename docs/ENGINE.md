# Manipura — Engine (WASM)

> Отдельный WASM-движок синтеза гласных. Собран из `generator/` (скопирован из `prism/generator/`, header-only).
> Анализатор PRISM (LPC/кепстр/SVM) **не входит** — движок только синтез.

## 1. Что внутри

```
manipura/
├── generator/           # скопировано из prism/generator (1:1, не менять)
│   ├── Presets.h        # 5 STD-спек + kStdU[64] + computeStdGains
│   ├── HarmonicSynth.h  # рендер 64 гармоник, H1 Boost, сглаживание
│   └── CMakeLists.txt   # header-only INTERFACE-библиотека prism_generator
├── wasm/
│   ├── wasm_wrapper.cpp # экспорты _manipura_synth_*
│   ├── CMakeLists.txt   # env=web,worker,node; output manipura.js/.wasm
│   ├── build.sh         # emcmake cmake + emmake make
│   └── build/
│       ├── manipura.js  # 38 KB (glue)
│       └── manipura.wasm# 32 KB (движок)
└── js/
    ├── wasm.js          # loadEngine(), renderVowel()
    ├── audio.js         # 5-voice mix + weightsFromIMU()
    └── app.js           # UI + IMU
```

## 2. Пресеты (STD, 6 гласных)

5 гласных — гауссовы формантные спеки, U — ручной массив.

| Гласная | F1 | F2 | F3 | F4 | F5 | Amp1 | Amp2 | Amp3 | Amp4 | Amp5 |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 700 | 1200 | 2500 | 2800 | 3600 | 0 | 0 | -5 | -7 | -24 |
| O | 440 | 750  | 2160 | 2860 | 3900 | -6 | -1 | -10 | -6 | -28 |
| U | (ручной kStdU[64]) | | | | | | | | | |
| Y | 300 | 1480 | 2230 | 3200 | 3800 | -5 | -10 | -12 | -15 | -20 |
| I | 215 | 1900 | 2630 | 3170 | 3710 | -10 | -10 | -8 | -4 | -15 |
| E | 410 | 2000 | 2570 | 2980 | 3900 | -1 | -3 | -2 | -2 | -5 |

Для **Manipura UI** используются только **A, O, U, E**. Y/I в буферах не рендерятся (оптимизация).

## 3. Формула STD (computeStdGains)

Для каждой гармоники `h_i = f0 * (i+1)`, `i ∈ [0, 63]`:

```
width_f  = freq_f * fwidth
gauss_f  = exp( -(h_i - freq_f)² / (2 * width_f²) )
linAmp_f = 10^(amps_f / 20)          # dB -> linear
total    = 0.01 + Σ_f (gauss_f * linAmp_f)   # f ∈ [0,4]
out[i]   = min(1.0, total)
out[0]   = 1.0                        # правило H1
```

Для **U** — `out = kStdU[64]` (ручной массив), `out[0] = 1.0`.

## 4. Инварианты (applyInvariants, не для U)

**Мост H1-H2:** `if (gains[0] > 0.1 && gains[1] < gains[0] * 0.15) gains[1] = gains[0] * 0.15`

**Арка резонанса:** для `i ∈ [5, 9]`, если `gains[i]` — локальный максимум и `> 0.1`:
`gains[i-1] = max(gains[i-1], gains[i] * 0.3)`, `gains[i+1] = max(gains[i+1], gains[i] * 0.3)`

## 5. H1 Boost (getFinalGains)

`gains[0] *= h1Boost`, clamp `[0, 1.5]`. Остальные без изменений. H1 Boost = 1.0 (по умолчанию).

## 6. Рендер (renderPCM / renderBlock)

```
coeff = 1 - exp(-1 / (smoothTime * sampleRate))   # smoothTime = 0.005 s
for n in [0, N):
    currentGains[h] += (targetGains[h] - currentGains[h]) * coeff
    sample += currentGains[h] * sin(phase[h])
    phase[h] += 2π * f0 * (h+1) / sampleRate
out[n] = sample * 0.2                              # master gain
```

**Важно:** `sample * 0.2` — это **master gain 0.2** (жёстко в C++). Пики 64 гармоник могут выйти за 1.0 — это **баг PRISM**, не чиним (см. `docs/AUDIO.md`, нормализация в JS).

## 7. API (WASM, все с префиксом `_manipura_synth_`)

| Функция | Аргументы | Что делает |
|---|---|---|
| `init` | `sampleRate: f64` | Установить sample rate |
| `set_preset` | `type: i32, vowel: i32` | 0=STD 1=MY 2=HYB; 0=A 1=O 2=U 3=Y 4=I 5=E |
| `set_f0` | `f0: f64` | F0 (Hz). Только STD |
| `set_fwidth` | `w: f64` | F-Width (0.01..0.3). Только STD |
| `set_h1_boost` | `b: f64` | H1 Boost (1.0 = off) |
| `set_inharm` | `v: f64` | Зарезервировано |
| `get_gains` | `double* out64` | Финальные gains (после H1 Boost) |
| `render` | `float* out, int n, f64 sr` | Additive PCM, phase-continuous |
| `render_block` | `float* out, int n, f64 sr` | То же, с block-сглаживанием |
| `reset_phase` | — | Сброс фаз |
| `morph` | `vA: i32, vB: i32, t: f64` | Морфинг в dB-шкале между двумя STD |

## 8. Сборка

```
cd ~/qrealab-workspace/projects/qonverse/manipura && bash wasm/build.sh
```

Требует Emscripten (`emcc` в PATH или `~/emsdk/emsdk_env.sh`).
Результат: `wasm/build/manipura.js` + `wasm/build/manipura.wasm`.

Проверено: `emcc 6.0.12`, macOS 26.6.2, Node 25.5.0.

## 9. Что НЕ делает движок

- Не анализирует звук (это `prism/web/build/prism_analyzer.wasm`)
- Не нормализует пики (это `js/audio.js`)
- Не обрабатывает IMU (это `js/app.js`)
- Не микширует 4 гласные + центр (это `js/audio.js`)
