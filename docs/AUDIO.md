# Manipura — Audio Chain

> 5-голосая смесь: 4 гласные (A, O, U, E) + центр (F0 sine).
> Web Audio, `AudioBufferSourceNode` (надёжно на iOS/Telegram, без AudioWorklet).

## 1. Схема

```
IMU (beta, gamma)
      │
      ▼
weightsFromIMU(beta, gamma)
      │ {A, O, U, E, C}  (сумма = 1.0)
      ▼
  ┌──────────┐
  │ Gain A   │◄── AudioBufferSourceNode(A, loop 1s)  ─┐
  │ Gain O   │◄── AudioBufferSourceNode(O, loop 1s)  ─┤
  │ Gain U   │◄── AudioBufferSourceNode(U, loop 1s)  ─┼──► master Gain ──► destination
  │ Gain E   │◄── AudioBufferSourceNode(E, loop 1s)  ─┤
  │ Gain C   │◄── OscillatorNode(sine, F0=100 Hz)   ─┘
  └──────────┘
```

Все источники стартуют один раз при `audio.start()`, играют бесконечно (loop). Меняются только **Gain**-значения (20 мс linear ramp, без щелчков).

## 2. Нормализация (per-vowel peak)

Движок отдаёт сырой PCM (пики 0.58..1.64 — клиппинг, баг PRISM `HarmonicSynth.h:121`).

```js
peak = max(|pcm[i]|)
if (peak < 1e-6) return pcm
g = 0.9 / peak   // TARGET_PEAK = 0.9
for i: pcm[i] *= g
```

**Зачем:**
- Убирает клиппинг (пики ≤ 0.9)
- Выравнивает громкость между гласными (было 3× разброс: A 1.64 vs Y 0.58)

## 3. weightsFromIMU (2D-морфинг)

Вход: `beta` (front/back, °), `gamma` (left/right, °). Диапазон ±90.

```js
a = max(0, -gamma / 90)   // left
e = max(0,  gamma / 90)   // right
u = max(0, -beta  / 90)   // front
o = max(0,  beta  / 90)   // back
sum = a + e + u + o

if (sum <= 1):
    return { A: a, O: o, U: u, E: e, C: 1 - sum }   // центр добивает до 1
else:
    return { A: a/sum, O: o/sum, U: u/sum, E: e/sum, C: 0 }  // нормализация
```

### Свойства

| Положение | beta | gamma | Веса | Что слышно |
|---|---|---|---|---|
| Центр | 0 | 0 | C=1.00 | Только F0 (100 Hz) |
| Лево полный | 0 | -90 | A=1.00 | Только A |
| Право полный | 0 | 90 | E=1.00 | Только E |
| Вперёд полный | -90 | 0 | U=1.00 | Только U |
| Назад полный | 90 | 0 | O=1.00 | Только O |
| Лево половина | 0 | -45 | A=0.50, C=0.50 | A наполовину с центром |
| Лево+вперёд диагональ | -45 | -45 | A=0.50, U=0.50, C=0 | Смесь A и U |
| Право+назад диагональ | 45 | 45 | E=0.50, O=0.50, C=0 | Смесь E и O |

**Сумма весов всегда = 1.00** (проверено на 10 кейсах, включая центр, края, половины, диагонали).

## 4. Сглаживание (без щелчков)

При каждом IMU-событии (≈60 Гц) вызывается `audio.setWeights(newW)`. Внутри:

```js
now = ctx.currentTime
for each gain:
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(target, now + 0.02)  // 20 мс
```

20 мс — достаточно, чтобы переход был плавным, но отзывчивым. Быстрее 50 Гц не нужно: IMU всё равно ~60 Гц.

## 5. Start / Stop

```js
audio.start(weights)  // строит граф при первом вызове, запускает все источники
audio.stop()          // master gain → 0 за 20 мс, источники продолжают играть
audio.start(weights)  // master gain → 0.5 за 20 мс
```

`stop` не убивает `AudioBufferSourceNode` (их нельзя перезапустить). Только глушит `master`.
`start` после `stop` — просто поднимает `master`. Это правильно и дёшево.

## 6. Master gain

`masterGain = 0.5` по умолчанию. Итог: пик после нормализации 0.9 × 5 голосов (если все на макс — но сумма весов = 1) → максимум 0.9 × 0.5 = 0.45. Комфортно, без клиппинга.

## 7. Sample rate

`48000 Hz` (жёстко в `SR`). iOS поддерживает 48000 (и 44100). `AudioContext` создаётся с `{ sampleRate: 48000 }`. WASM `render` получает тот же `SR`.

Если iOS выдаст 44100 — `AudioContext` ресемплит. Работает.

## 8. Что НЕ входит

- Нет AudioWorklet (риски `fetch`/`importScripts` в Safari/Telegram WebView)
- Нет полифонии по нескольким касаниям (это будущий шаг)
- Нет F0-слайдера (F0 = 100 жёстко). Следующий шаг — F0 от второй оси
- Нет stereo (моно, 1 канал)

## 9. Отладка

В консоли Safari Web Inspector (Mac → Develop → [iPhone] → manipura) видны:
- `weightsFromIMU(beta, gamma)` — можно вызвать вручную
- ошибки WASM/audio при `init()`

Проверка в Node (без AudioContext): `import("./js/audio.js").then(m => m.weightsFromIMU(0, -45))` → `{A:0.5, ..., C:0.5}`.
