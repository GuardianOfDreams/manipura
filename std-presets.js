// Manipura — STD presets (data only, no logic).
// 1:1 copy from prism/generator/Presets.h (lines 38-77).
// 5 formant specs (A,O,Y,I,E) + manual kStdU[64]. U is NOT gaussian.
// Do not edit values here without syncing with prism/generator/Presets.h.

export const kNumHarmonics = 64;

export const STD_SPECS = {
  A: { freqs: [700.0, 1200.0, 2500.0, 2800.0, 3600.0], amps: [0.0, 0.0, -5.0, -7.0, -24.0] },
  O: { freqs: [440.0, 750.0, 2160.0, 2860.0, 3900.0], amps: [-6.0, -1.0, -10.0, -6.0, -28.0] },
  Y: { freqs: [300.0, 1480.0, 2230.0, 3200.0, 3800.0], amps: [-5.0, -10.0, -12.0, -15.0, -20.0] },
  I: { freqs: [215.0, 1900.0, 2630.0, 3170.0, 3710.0], amps: [-10.0, -10.0, -8.0, -4.0, -15.0] },
  E: { freqs: [410.0, 2000.0, 2570.0, 2980.0, 3900.0], amps: [-1.0, -3.0, -2.0, -2.0, -5.0] }
};

// Manual U array (Presets.h lines 67-77). Peaks: H3=0.47, H7-H8=0.29.
// Tail up to H40, then 0. Preserved exactly per JOURNAL 2.32.
export const STD_U = [
  1.00, 0.01, 0.47, 0.01, 0.01, 0.03, 0.29, 0.29,
  0.03, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  0.01,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
];
