#pragma once
// PRISM generator — HarmonicSynth (Smoothed version)

#include "Presets.h"
#include <array>
#include <cmath>
#include <cstddef>

namespace prism::generator {

enum class PresetType { STD, MY, HYB };
enum class VowelId : int { A = 0, O = 1, U = 2, Y = 3, I = 4, E = 5 };

struct SynthParams {
    PresetType preset = PresetType::STD;
    VowelId    vowel  = VowelId::A;
    double     f0     = 100.0;
    double     h1Boost = 1.0;
    double     fwidth  = 0.08;
    double     inharm  = 0.0;
};

class HarmonicSynth {
public:
    static constexpr int kHarmonics = kNumHarmonics;

    HarmonicSynth() { 
        setPreset(PresetType::STD, VowelId::A); 
        // При инициализации текущие gains равны целевым (чтобы не было щелчка при старте)
        for (int i = 0; i < kHarmonics; ++i) currentGains_[i] = targetGains_[i];
    }

    void setPreset(PresetType type, VowelId v) {
        params_.preset = type;
        params_.vowel  = v;
        if (type == PresetType::MY || type == PresetType::HYB) {
            params_.f0 = 100.0;
        }
        recompute();
    }

    void setF0(double f0) {
        params_.f0 = f0;
        if (params_.preset == PresetType::STD) recompute();
    }

    void setH1Boost(double boost) { params_.h1Boost = boost; }

    void setFWidth(double w) {
        params_.fwidth = w;
        if (params_.preset == PresetType::STD) recompute();
    }

    void setInharm(double v) { params_.inharm = v; }

    // Morph between two STD vowels in dB scale.
    void morphStd(VowelId vowelA, VowelId vowelB, double t) {
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;

        std::array<double, kHarmonics> gainsA{};
        std::array<double, kHarmonics> gainsB{};
        computeStdGainsForVowel(vowelA, 100.0, 0.08, gainsA.data());
        computeStdGainsForVowel(vowelB, 100.0, 0.08, gainsB.data());

        for (int i = 0; i < kHarmonics; ++i) {
            double ampA = std::max(gainsA[i], 1e-6);
            double ampB = std::max(gainsB[i], 1e-6);
            double dbA = 20.0 * std::log10(ampA);
            double dbB = 20.0 * std::log10(ampB);
            double dbMix = (1.0 - t) * dbA + t * dbB;
            targetGains_[i] = std::pow(10.0, dbMix / 20.0);
            if (targetGains_[i] > 1.0) targetGains_[i] = 1.0;
        }
        targetGains_[0] = 1.0;
        applyInvariants(targetGains_.data());
    }

    const SynthParams& params() const { return params_; }
    const std::array<double, kHarmonics>& baseGains() const { return targetGains_; }

    // Возвращает целевые gains (для UI)
    void getFinalGains(double* out) const {
        for (int i = 0; i < kHarmonics; ++i) {
            double g = targetGains_[i];
            if (i == 0) g *= params_.h1Boost;
            if (g > 1.5) g = 1.5;
            if (g < 0.0) g = 0.0;
            out[i] = g;
        }
    }

    // Непрерывный рендер со сглаживанием
    void renderBlock(float* out, int numSamples, double sampleRate) {
        if (out == nullptr || numSamples <= 0 || sampleRate <= 0.0) return;
        
        // Время сглаживания: 5 мс. Коэффициент для one-pole фильтра.
        const double smoothTime = 0.005; 
        const double coeff = 1.0 - std::exp(-1.0 / (smoothTime * sampleRate));

        double finalTargets[kHarmonics];
        getFinalGains(finalTargets);

        const double twoPi = 2.0 * M_PI;
        const double invSr = 1.0 / sampleRate;

        for (int n = 0; n < numSamples; ++n) {
            double sample = 0.0;
            for (int h = 0; h < kHarmonics; ++h) {
                // Плавно подтягиваем текущий gain к целевому
                currentGains_[h] += (finalTargets[h] - currentGains_[h]) * coeff;
                
                const double gain = currentGains_[h];
                if (gain > 1e-5) {
                    const double omega = twoPi * params_.f0 * static_cast<double>(h + 1);
                    sample += gain * std::sin(phase_[h]);
                    phase_[h] += omega * invSr;
                    if (phase_[h] >= twoPi) phase_[h] -= twoPi;
                }
            }
            out[n] = static_cast<float>(sample * 0.2); // master gain
        }
    }

    // Старый метод (для совместимости, рендерит кусок)
    void renderPCM(float* out, int numSamples, double sampleRate) {
        renderBlock(out, numSamples, sampleRate);
    }

    void resetPhase() {
        for (int h = 0; h < kHarmonics; ++h) phase_[h] = 0.0;
    }

private:
    void applyInvariants(double* gains) {
        double min_h2 = gains[0] * 0.15;
        if (gains[0] > 0.1 && gains[1] < min_h2) {
            gains[1] = min_h2;
        }
        for (int i = 5; i < 10; ++i) {
            if (gains[i] > gains[i-1] && gains[i] > gains[i+1] && gains[i] > 0.1) {
                double shoulder = gains[i] * 0.3;
                if (gains[i-1] < shoulder) gains[i-1] = shoulder;
                if (gains[i+1] < shoulder) gains[i+1] = shoulder;
            }
        }
    }

    void recompute() {
        switch (params_.preset) {
            case PresetType::STD: recomputeSTD(); break;
            case PresetType::MY:  recomputeMY();  break;
            case PresetType::HYB: recomputeHYB(); break;
        }
    }

    void recomputeSTD() {
        switch (params_.vowel) {
            case VowelId::A: computeStdGains(kStdA, params_.f0, params_.fwidth, targetGains_.data()); break;
            case VowelId::O: computeStdGains(kStdO, params_.f0, params_.fwidth, targetGains_.data()); break;
            case VowelId::Y: computeStdGains(kStdY, params_.f0, params_.fwidth, targetGains_.data()); break;
            case VowelId::I: computeStdGains(kStdI, params_.f0, params_.fwidth, targetGains_.data()); break;
            case VowelId::E: computeStdGains(kStdE, params_.f0, params_.fwidth, targetGains_.data()); break;
            case VowelId::U: {
                for (int i = 0; i < kHarmonics; ++i) targetGains_[i] = kStdU[i];
                targetGains_[0] = 1.0;
                break;
            }
        }
        if (params_.vowel != VowelId::U) {
            applyInvariants(targetGains_.data());
        }
    }

    void recomputeMY() {
        switch (params_.vowel) {
            case VowelId::A: copyArray(kMyA); break;
            case VowelId::O: copyArray(kMyO); break;
            case VowelId::U: copyArray(kMyU); break;
            case VowelId::Y: copyArray(kMyY); break;
            case VowelId::I: copyArray(kMyI); break;
            case VowelId::E: copyArray(kMyE); break;
        }
    }

    void recomputeHYB() {
        std::array<double, kHarmonics> stdGains{};
        computeStdGainsForVowel(params_.vowel, 100.0, 0.08, stdGains.data());
        stdGains[0] = 1.0;

        const double* myGains = myArray(params_.vowel);
        for (int i = 0; i < kHarmonics; ++i) {
            targetGains_[i] = (stdGains[i] + myGains[i]) / 2.0;
        }
        targetGains_[0] = 1.0;
        applyInvariants(targetGains_.data());
    }

    void copyArray(const double* src) {
        for (int i = 0; i < kHarmonics; ++i) targetGains_[i] = src[i];
    }

    void computeStdGainsForVowel(VowelId v, double f0, double fwidth, double* out) {
        switch (v) {
            case VowelId::A: computeStdGains(kStdA, f0, fwidth, out); break;
            case VowelId::O: computeStdGains(kStdO, f0, fwidth, out); break;
            case VowelId::Y: computeStdGains(kStdY, f0, fwidth, out); break;
            case VowelId::I: computeStdGains(kStdI, f0, fwidth, out); break;
            case VowelId::E: computeStdGains(kStdE, f0, fwidth, out); break;
            case VowelId::U: {
                for (int i = 0; i < kHarmonics; ++i) out[i] = kStdU[i];
                out[0] = 1.0;
                break;
            }
        }
    }

    static const double* myArray(VowelId v) {
        switch (v) {
            case VowelId::A: return kMyA;
            case VowelId::O: return kMyO;
            case VowelId::U: return kMyU;
            case VowelId::Y: return kMyY;
            case VowelId::I: return kMyI;
            case VowelId::E: return kMyE;
        }
        return kMyA;
    }

    SynthParams params_{};
    std::array<double, kHarmonics> targetGains_{};  // Куда стремимся
    std::array<double, kHarmonics> currentGains_{}; // Где находимся (для сглаживания)
    std::array<double, kHarmonics> phase_{};        // Непрерывная фаза
};

} // namespace prism::generator
