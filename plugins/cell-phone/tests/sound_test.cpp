#include "sound.h"

#include <algorithm>
#include <cstdlib>

#include "check.h"

/** @brief Energy of `hz` in samples [from, to), by the Goertzel algorithm. */
static double Energy(const std::vector<int16_t> &pcm, size_t from, size_t to, double hz)
{
    const double w = 6.283185307179586 * hz / kSampleRate;
    const double c = 2.0 * std::cos(w);
    double s1 = 0.0, s2 = 0.0;
    for (size_t i = from; i < to; ++i)
    {
        const double s = pcm[i] / 32768.0 + c * s1 - s2;
        s2 = s1;
        s1 = s;
    }
    return s1 * s1 + s2 * s2 - c * s1 * s2;
}

static int Peak(const std::vector<int16_t> &pcm, size_t from, size_t to)
{
    int peak = 0;
    for (size_t i = from; i < to; ++i)
    {
        peak = std::max(peak, std::abs(static_cast<int>(pcm[i])));
    }
    return peak;
}

int main()
{
    const size_t ms = kSampleRate / 1000;

    {
        // Ringback: one 2 second burst. The dial ends after 3 seconds, so no silence follows it
        const std::vector<int16_t> pcm = RenderTone(kRingback, 1.0f);
        CHECK(pcm.size() == 2000 * ms);
        CHECK(Peak(pcm, 100 * ms, 1900 * ms) > 0.29 * 32767 && Peak(pcm, 0, 2000 * ms) <= 0.30 * 32767 + 1);
        CHECK(Peak(pcm, 0, 4) < 100);
        const double at440 = Energy(pcm, 100 * ms, 1900 * ms, 440.0);
        const double at480 = Energy(pcm, 100 * ms, 1900 * ms, 480.0);
        const double at1000 = Energy(pcm, 100 * ms, 1900 * ms, 1000.0);
        CHECK(at440 > 100.0 * at1000 && at480 > 100.0 * at1000);
    }
    {
        // Busy: four bursts of 0.5 seconds with 0.5 seconds between
        const std::vector<int16_t> pcm = RenderTone(kBusy, 1.0f);
        CHECK(pcm.size() == ToneDurationMs(kBusy) * ms);
        CHECK(PhoneMachine::kBusyToneMs == 4000);
        for (int cycle = 0; cycle < 4; ++cycle)
        {
            const size_t start = cycle * 1000 * ms;
            CHECK(Peak(pcm, start + 50 * ms, start + 450 * ms) > 0.29 * 32767);
            CHECK(Peak(pcm, start + 500 * ms, start + 1000 * ms) == 0);
        }
        const double at480 = Energy(pcm, 50 * ms, 450 * ms, 480.0);
        const double at620 = Energy(pcm, 50 * ms, 450 * ms, 620.0);
        const double at440 = Energy(pcm, 50 * ms, 450 * ms, 440.0);
        CHECK(at480 > 20.0 * at440 && at620 > 20.0 * at440);
    }
    {
        // Gain scales the level, and zero gain is silent
        const int full = Peak(RenderTone(kBusy, 1.0f), 0, 500 * ms);
        const int half = Peak(RenderTone(kBusy, 0.5f), 0, 500 * ms);
        CHECK(std::abs(half * 2 - full) <= 2);
        CHECK(Peak(RenderTone(kBusy, 0.0f), 0, 4000 * ms) == 0);
    }
    {
        // Each digit key sounds its standard DTMF pair for 100 ms, and no other row or column tone. The expected
        // pairs are written out here, so a typo in the table in tones.h cannot also pass the test.
        const float expected[10][2] = {{941, 1336}, {697, 1209}, {697, 1336}, {697, 1477}, {770, 1209},
                                       {770, 1336}, {770, 1477}, {852, 1209}, {852, 1336}, {852, 1477}};
        const float rows[4] = {697.0f, 770.0f, 852.0f, 941.0f};
        const float cols[3] = {1209.0f, 1336.0f, 1477.0f};
        for (int digit = 0; digit <= 9; ++digit)
        {
            const float low = expected[digit][0];
            const float high = expected[digit][1];
            CHECK(DtmfTone(digit).lowHz == low && DtmfTone(digit).highHz == high);
            const std::vector<int16_t> pcm = RenderTone(DtmfTone(digit), 1.0f);
            CHECK(pcm.size() == 100 * ms);
            CHECK(Energy(pcm, 20 * ms, 80 * ms, low) > 1000.0 && Energy(pcm, 20 * ms, 80 * ms, high) > 1000.0);
            for (const float f : rows)
            {
                CHECK(f == low || Energy(pcm, 20 * ms, 80 * ms, f) < 0.02 * Energy(pcm, 20 * ms, 80 * ms, low));
            }
            for (const float f : cols)
            {
                CHECK(f == high || Energy(pcm, 20 * ms, 80 * ms, f) < 0.02 * Energy(pcm, 20 * ms, 80 * ms, high));
            }
        }
    }
    {
        // The sound effects setting maps a byte to the slider, and an unreadable value to the game's default
        CHECK(SfxVolumeFromRaw(0) == 0);
        CHECK(SfxVolumeFromRaw(127) == 127);
        CHECK(SfxVolumeFromRaw(128) == kSfxDefault);
        CHECK(SfxVolumeFromRaw(-1) == kSfxDefault);
    }
    return 0;
}
