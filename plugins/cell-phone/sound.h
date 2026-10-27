#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <mmsystem.h>

#include <cmath>
#include <cstdint>
#include <vector>

#include "phone_machine.h"
#include "tones.h"

constexpr uint32_t kSampleRate = 44100;

/** @brief Level of each of the two sines at full volume. The editor's reference tones use the same 0.15. */
constexpr float kToneLevel = 0.15f;

/** @brief Length of the fade in and the fade out of each burst, so the tone starts and stops without a click. */
constexpr uint32_t kFadeMs = 10;

/** @brief The game's sound effects slider runs 0 to 127. 102 is the game's default, used when the setting cannot be read. */
constexpr int kSfxMax = 127;
constexpr int kSfxDefault = 102;

/** @brief Turns the raw sound effects setting into a slider value, or the default when it is out of range. */
inline int SfxVolumeFromRaw(int raw)
{
    return raw >= 0 && raw <= kSfxMax ? raw : kSfxDefault;
}

/**
 * @brief Renders a tone cadence to 16-bit mono PCM at `kSampleRate`.
 * @param gain The sound effects volume as 0.0 to 1.0.
 */
inline std::vector<int16_t> RenderTone(const ToneSpec &spec, float gain)
{
    const uint32_t onSamples = kSampleRate / 1000 * spec.onMs;
    const uint32_t offSamples = kSampleRate / 1000 * spec.offMs;
    const uint32_t fadeSamples = kSampleRate / 1000 * kFadeMs;
    const double tau = 6.283185307179586;
    std::vector<int16_t> out(static_cast<size_t>(onSamples + offSamples) * spec.cycles, 0);
    for (int cycle = 0; cycle < spec.cycles; ++cycle)
    {
        const size_t base = static_cast<size_t>(onSamples + offSamples) * cycle;
        for (uint32_t i = 0; i < onSamples; ++i)
        {
            const double t = static_cast<double>(i) / kSampleRate;
            float envelope = 1.0f;
            if (i < fadeSamples)
            {
                envelope = static_cast<float>(i) / fadeSamples;
            }
            else if (i >= onSamples - fadeSamples)
            {
                envelope = static_cast<float>(onSamples - i) / fadeSamples;
            }
            const double s = std::sin(tau * spec.lowHz * t) + std::sin(tau * spec.highHz * t);
            out[base + i] = static_cast<int16_t>(std::lround(s * kToneLevel * gain * envelope * 32767.0));
        }
    }
    return out;
}

/**
 * @brief Plays the phone's synthesized tones through the Windows wave device, scaled by the game's sound effects volume.
 *
 * The incoming ringtone is a WAV that the script plays, so this class plays only ringback, busy, and digit tones.
 * All calls come from the game thread.
 */
class PhoneSound
{
public:
    /** @brief Ends the ringback when the dial ends, and silences every tone once the phone is lowered. */
    void OnState(int state);

    /** @brief Plays the ringback or busy tone when the machine asks for one. Other beeps are ignored. */
    void OnBeep(PhoneBeep beep);

    /** @brief Plays the DTMF tone of a digit key, 0 to 9. Any other value is silent. */
    void OnDigit(int digit);

private:
    void Play(const ToneSpec &spec);
    void Stop();

    HWAVEOUT m_out = nullptr;
    WAVEHDR m_header = {};
    std::vector<int16_t> m_samples;
    bool m_ringbackPlaying = false;
};

/** @brief Reads the game's sound effects slider (0 to 127) from the menu manager, or returns the default when it cannot be read. */
int ReadSfxVolume();
