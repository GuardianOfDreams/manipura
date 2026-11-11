# Manipura — IMU (DeviceOrientation)

> Источник данных: `window.addEventListener("deviceorientation", handler)`.
> На iOS 13+ требуется явный `DeviceOrientationEvent.requestPermission()` (только после user gesture).

## 1. Как держать телефон

**Экран параллелен горизонту, смотрит вверх.** Это «нейтральное» положение: `beta ≈ 0`, `gamma ≈ 0`. IMU читает **наклоны от этой плоскости**, а не углы Эйлера в воздухе.

```
         beta < 0 (передний край вниз)  = U
                    ▲
                    │
  gamma < 0  ◄──────┼──────►  gamma > 0
  (крен влево) A    │    (крен вправо) E
                    ▼
         beta > 0 (задний край вниз)  = O

  центр (0,0) = C (только F0)
```

## 2. Что приходит в событии

`DeviceOrientationEvent` содержит три поля (градусы, `null` если недоступно):

| Поле | Что | Диапазон | В Manipura |
|---|---|---|---|
| `alpha` | Компас (вокруг вертикальной оси Z) | 0..360 | **Не используется** (только readout) |
| `beta` | Наклон вперёд/назад (вокруг X) | -180..180 | **U** (< 0), **O** (> 0) |
| `gamma` | Наклон влево/вправо (вокруг Y) | -90..90 | **A** (< 0), **E** (> 0) |

**Точные границы** (из `audio.js`):

- `beta` передаётся в `weightsFromIMU` как есть, делится на 90 и clamp по `max(0, ±x/90)`
- `gamma` так же
- Реальные отклонения обычно ±0..60°, полный ±90° достигается при вертикальном положении

## 3. Порядок включения (важно на iOS)

1. Пользователь нажимает **Start Sound** — это **user gesture**, активирует `AudioContext`
2. Пользователь нажимает **Enable Orientation** → iOS показывает диалог разрешения → Allow
3. С этого момента `deviceorientation` приходит

**Почему этот порядок:**
- `AudioContext` на iOS требует user gesture, иначе `state = "suspended"`
- `DeviceOrientationEvent.requestPermission()` тоже требует user gesture
- Кнопки — единственный надёжный способ

## 4. Если IMU недоступен

Возможные причины:
- iOS < 13 (не нужен `requestPermission`, событие приходит сразу)
- Отказ пользователя в диалоге
- Десктопный браузер (нет IMU)
- Telegram WebView (зависит от версии iOS; на iOS 15+ работает)

`hasOrientation` в `app.js` = `true` только после первого события. Если `false` — все readout `—`, звук = центр (C).

## 5. Что рисуется (2D-крест)

- **Кольцо** + тики каждые 10°
- **Крест** (две тонкие линии)
- **4 буквы**: `U` сверху, `E` справа, `O` снизу, `A` слева
- **C** под центром, если `w.C > 0.5`
- **Точка наклона** (оранжевая): `(gx, gy) = (gamma/90, beta/90)`, clamp ±1, на радиусе `r-20`
- **Линия** от центра к точке

Точка — это текущий вектор наклона. При нулевом наклоне точка в центре. При наклоне влево — уходит влево.

## 6. Readout

| Поле | Что |
|---|---|
| `VOWEL` | Доминирующая гласная + %: `A 50%` / `U 50%` / `C` (центр) |
| `ALPHA` | Компас, ° (0..360) — **не влияет на звук** |
| `BETA/GAMMA` | Сырые значения: `18/0` (18° beta, 0° gamma) |

## 7. Сглаживание (что уже есть)

- **Gain smoothing:** 20 мс linear ramp в `audio._applyWeights`
- **IMU sampling:** событие приходит от iOS с частотой ~60 Гц (iOS throttling)
- **Нет дополнительного фильтра** — сырые `beta`/`gamma` идут напрямую

Если на слух будут «дрожания» — следующий шаг: one-pole фильтр (α = 0.2) на `beta`/`gamma` перед `weightsFromIMU`.

## 8. API

```js
DeviceOrientationEvent.requestPermission()  // iOS 13+: "granted" | "denied" | "default"
window.addEventListener("deviceorientation", handler, true)

function handler(e) {
  e.alpha  // 0..360, компас
  e.beta   // -180..180, наклон вперёд/назад
  e.gamma  // -90..90, наклон влево/вправо
}
```

`null` означает «датчик не даёт это значение». `0` — валидное значение (не путать).

## 9. Источники

- MDN: DeviceOrientationEvent (developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent)
- W3C: DeviceOrientation Event Specification
- Telegram WebApp: `DeviceOrientationEvent` в WebView (iOS 15+)
