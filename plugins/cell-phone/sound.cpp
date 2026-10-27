/**
 * @file sound.cpp
 * @brief Plays the cell phone's ringback and busy tones, scaled by the game's sound effects volume.
 */

#include "sound.h"

// The sound effects slider is a byte in the front end menu manager of gta-vc.exe v1.0. The manager is at
// 0x869630 and the slider is at +0x29, which is 0x869659 (GTAMods "Memory Addresses (VC)"). The music slider is
// the next byte. Both run 0 to 127.
static constexpr uintptr_t kSfxVolumeAddress = 0x869659;

int ReadSfxVolume()
{
    int raw = -1;
    __try
    {
        raw = *reinterpret_cast<volatile const uint8_t *>(kSfxVolumeAddress);
    }
    __except (EXCEPTION_EXECUTE_HANDLER)
    {
        raw = -1;
    }
    return SfxVolumeFromRaw(raw);
}

void PhoneSound::OnState(int state)
{
    // Stop is a no-op when nothing plays
    if (state == StateLowered || (m_ringbackPlaying && state != StateRingingOut))
    {
        Stop();
    }
}

void PhoneSound::OnBeep(PhoneBeep beep)
{
    if (beep == BeepRingback)
    {
        Play(kRingback);
        m_ringbackPlaying = m_out != nullptr;
    }
    else if (beep == BeepBusy)
    {
        Play(kBusy);
    }
}

void PhoneSound::OnDigit(int digit)
{
    if (digit >= 0 && digit <= 9)
    {
        Play(DtmfTone(digit));
    }
}

void PhoneSound::Play(const ToneSpec &spec)
{
    Stop();
    const int volume = ReadSfxVolume();
    if (volume <= 0)
    {
        return;
    }
    m_samples = RenderTone(spec, static_cast<float>(volume) / kSfxMax);

    WAVEFORMATEX format = {};
    format.wFormatTag = WAVE_FORMAT_PCM;
    format.nChannels = 1;
    format.nSamplesPerSec = kSampleRate;
    format.wBitsPerSample = 16;
    format.nBlockAlign = format.nChannels * format.wBitsPerSample / 8;
    format.nAvgBytesPerSec = format.nSamplesPerSec * format.nBlockAlign;
    if (waveOutOpen(&m_out, WAVE_MAPPER, &format, 0, 0, CALLBACK_NULL) != MMSYSERR_NOERROR)
    {
        m_out = nullptr;
        return;
    }

    m_header = {};
    m_header.lpData = reinterpret_cast<LPSTR>(m_samples.data());
    m_header.dwBufferLength = static_cast<DWORD>(m_samples.size() * sizeof(int16_t));
    if (waveOutPrepareHeader(m_out, &m_header, sizeof(m_header)) != MMSYSERR_NOERROR ||
        waveOutWrite(m_out, &m_header, sizeof(m_header)) != MMSYSERR_NOERROR)
    {
        Stop();
    }
}

void PhoneSound::Stop()
{
    if (m_out)
    {
        // Reset returns the buffer to us, so it can be unprepared while the device is still open
        waveOutReset(m_out);
        waveOutUnprepareHeader(m_out, &m_header, sizeof(m_header));
        waveOutClose(m_out);
        m_out = nullptr;
    }
    m_ringbackPlaying = false;
}
