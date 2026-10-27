#pragma once

#include <cstdint>
#include <string>

#include "tones.h"

enum PhoneKey { KeyNone = -1, KeyBackspace = 10, KeyDial = 11, KeyEscape = 12, KeyToggle = 13, KeyAnswer = 14 };
enum PhoneState { StateLowered, StateRaised, StateRingingOut, StateDialed, StateRingingIn, StateConnected };
enum PhoneEvent { EventNone, EventDialDone, EventAnswered, EventHungUp, EventMissed, EventDeclined };
enum PhoneBeep { BeepNone, BeepRing, BeepRingback, BeepBusy };
enum PhoneResult { ResultConnected = 1, ResultBusy = 2, ResultOver = 3 };

/** @brief What the script reads each frame. `animating` is 1 while the phone slides up or down. */
struct PhoneView
{
    int state;
    int lit;
    int animating;
    int digitCount;
    int number;
    int event;
};

/** @brief The phone's state, digits, and timers. Time is passed in, so tests need no clock. */
class PhoneMachine
{
public:
    static constexpr int kMaxDigits = 7;
    static constexpr uint32_t kBacklightMs = 5000;
    static constexpr uint32_t kSlideMs = 550;
    static constexpr uint32_t kRingOutMs = 3000;
    static constexpr uint32_t kRingInMs = 20000;
    static constexpr uint32_t kRingInBeatMs = 2000;
    // A number with no handler connects, goes quiet for kBusyDelayMs, plays the busy tone for kBusyToneMs,
    // and then the call drops back to number entry.
    static constexpr uint32_t kBusyDelayMs = 2000;
    static constexpr uint32_t kBusyToneMs = ToneDurationMs(kBusy);

    /** @brief Handles one key (or KeyNone), then runs the timers. A blocked phone lowers and ignores keys. */
    PhoneView Tick(uint32_t now, int key, bool blocked)
    {
        int event = EventNone;
        const bool up = m_state != StateLowered && m_state != StateRingingIn;
        if (blocked)
        {
            if (up)
            {
                Lower(now);
            }
        }
        else
        {
            event = HandleKey(now, key);
        }
        if (m_state == StateRingingOut)
        {
            if (m_nextBeat && now >= m_nextBeat)
            {
                m_beep = BeepRingback;
                m_nextBeat = 0;
            }
            if (now >= m_phaseStart + kRingOutMs)
            {
                m_state = StateDialed;
                event = EventDialDone;
            }
        }
        else if (m_state == StateRingingIn)
        {
            // The phone is shown and backlit for the whole ring, so the backlight does not time out
            Light(now);
            if (now >= m_nextBeat)
            {
                m_beep = BeepRing;
                m_nextBeat += kRingInBeatMs;
            }
            if (now >= m_phaseStart + kRingInMs)
            {
                Lower(now);
                event = EventMissed;
            }
        }
        if (m_busyAt && now >= m_busyAt)
        {
            m_busyAt = 0;
            m_beep = BeepBusy;
        }
        else if (m_busyEnd && now >= m_busyEnd)
        {
            m_busyEnd = 0;
            m_state = StateRaised;
            m_digits.clear();
            Light(now);
        }
        int number = 0;
        for (char c : m_digits)
        {
            number = number * 10 + (c - '0');
        }
        return PhoneView{m_state, now < m_litUntil ? 1 : 0, m_slid && now - m_slideStart < kSlideMs ? 1 : 0,
                         static_cast<int>(m_digits.size()), number, event};
    }

    /** @brief Starts an incoming ring, and the phone slides up. Ignored unless the phone is lowered. */
    void RingIncoming(uint32_t now)
    {
        if (m_state != StateLowered)
        {
            return;
        }
        m_state = StateRingingIn;
        m_phaseStart = now;
        m_nextBeat = now + kRingInBeatMs;
        m_beep = BeepRing;
        StartSlide(now);
        Light(now);
    }

    /** @brief The script's answer to a dialed number (state Dialed), or the end of a connected call. */
    void Resolve(uint32_t now, int result)
    {
        if (result == ResultConnected && m_state == StateDialed)
        {
            m_state = StateConnected;
            Light(now);
        }
        else if (result == ResultBusy && m_state == StateDialed)
        {
            // The call connects like any other, so the HUD keeps its timer while the busy tone plays
            m_state = StateConnected;
            m_busyAt = now + kBusyDelayMs;
            m_busyEnd = m_busyAt + kBusyToneMs;
            Light(now);
        }
        else if (result == ResultOver && (m_state == StateDialed || m_state == StateConnected))
        {
            Lower(now);
        }
    }

    /** @brief Returns the digit key pressed since the last call, 0 to 9, or -1 for none, and clears it. */
    int TakeDigit()
    {
        const int digit = m_digit;
        m_digit = -1;
        return digit;
    }

    /** @brief Returns the beep to play now and clears it. */
    PhoneBeep TakeBeep()
    {
        const PhoneBeep beep = m_beep;
        m_beep = BeepNone;
        return beep;
    }

private:
    int HandleKey(uint32_t now, int key)
    {
        switch (m_state)
        {
        case StateLowered:
            if (key == KeyToggle)
            {
                Raise(now);
            }
            break;
        case StateRaised:
            if (key >= 0 && key <= 9)
            {
                m_digit = key;
                if (static_cast<int>(m_digits.size()) < kMaxDigits)
                {
                    m_digits.push_back(static_cast<char>('0' + key));
                }
                Light(now);
            }
            else if (key == KeyBackspace)
            {
                if (!m_digits.empty())
                {
                    m_digits.pop_back();
                }
                Light(now);
            }
            else if (key == KeyDial && !m_digits.empty())
            {
                m_state = StateRingingOut;
                m_phaseStart = now;
                m_nextBeat = now + kRingbackDelayMs;
                Light(now);
            }
            else if (key == KeyToggle || key == KeyEscape)
            {
                Lower(now);
            }
            break;
        case StateRingingOut:
        case StateDialed:
            if (key == KeyToggle || key == KeyEscape)
            {
                Lower(now);
            }
            break;
        case StateRingingIn:
            if (key == KeyAnswer)
            {
                m_state = StateConnected;
                StartSlide(now);
                Light(now);
                return EventAnswered;
            }
            if (key == KeyToggle)
            {
                Lower(now);
                return EventDeclined;
            }
            break;
        case StateConnected:
            if (key == KeyToggle || key == KeyEscape)
            {
                Lower(now);
                return EventHungUp;
            }
            break;
        }
        return EventNone;
    }

    void StartSlide(uint32_t now)
    {
        m_slid = true;
        m_slideStart = now;
    }

    void Light(uint32_t now) { m_litUntil = now + kBacklightMs; }

    void Raise(uint32_t now)
    {
        m_state = StateRaised;
        m_digits.clear();
        StartSlide(now);
        Light(now);
    }

    void Lower(uint32_t now)
    {
        m_state = StateLowered;
        m_digits.clear();
        m_litUntil = 0;
        m_busyAt = 0;
        m_busyEnd = 0;
        StartSlide(now);
    }

    PhoneState m_state = StateLowered;
    PhoneBeep m_beep = BeepNone;
    int m_digit = -1;
    uint32_t m_busyAt = 0;
    uint32_t m_busyEnd = 0;
    std::string m_digits;
    uint32_t m_litUntil = 0;
    uint32_t m_phaseStart = 0;
    uint32_t m_nextBeat = 0;
    uint32_t m_slideStart = 0;
    bool m_slid = false;
};
