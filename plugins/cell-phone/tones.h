#pragma once

#include <cstdint>

/** @brief A cadence of two tones that sound together: `onMs` of sound, `offMs` of silence, repeated `cycles` times. */
struct ToneSpec
{
    float lowHz;
    float highHz;
    uint32_t onMs;
    uint32_t offMs;
    int cycles;
};

/** @brief The whole length of a cadence, including the silence after the last burst. */
constexpr uint32_t ToneDurationMs(const ToneSpec &spec)
{
    return (spec.onMs + spec.offMs) * spec.cycles;
}

/**
 * @brief US ringback, as in the ringtone editor's reference tones: 440 Hz plus 480 Hz, 2 seconds on, then 4 seconds off.
 * The 4 seconds of silence are left out because the 3 second dial ends first and cuts the tone.
 */
constexpr ToneSpec kRingback{440.0f, 480.0f, 2000, 0, 1};

/** @brief US busy, as in the ringtone editor's reference tones: 480 Hz plus 620 Hz, 0.5 seconds on, 0.5 seconds off. */
constexpr ToneSpec kBusy{480.0f, 620.0f, 500, 500, 4};

/**
 * @brief Ringback starts this long after the dial, when the HUD swaps the dialed number for the call timer.
 * The HUD's own 500 ms is the `timerb < 500` test in lib/threads/cellphone.txt, so the two must change together.
 */
constexpr uint32_t kRingbackDelayMs = 500;

/** @brief How long a digit key's tone sounds. */
constexpr uint32_t kDigitToneMs = 100;

/** @brief The standard DTMF pair for a digit key, 0 to 9: a row tone from 697 to 941 Hz plus a column tone from 1209 to 1477 Hz. */
inline ToneSpec DtmfTone(int digit)
{
    constexpr float rows[4] = {697.0f, 770.0f, 852.0f, 941.0f};
    constexpr float cols[3] = {1209.0f, 1336.0f, 1477.0f};
    const int row = digit == 0 ? 3 : (digit - 1) / 3;
    const int col = digit == 0 ? 1 : (digit - 1) % 3;
    return ToneSpec{rows[row], cols[col], kDigitToneMs, 0, 1};
}
