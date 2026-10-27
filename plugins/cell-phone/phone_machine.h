#pragma once

#include <cstdint>
#include <string>

enum PhoneKey { KeyNone = -1, KeyBackspace = 10, KeyDial = 11, KeyEscape = 12, KeyToggle = 13, KeyAnswer = 14 };
enum PhoneState { StateLowered, StateRaised, StateRingingOut, StateDialed, StateRingingIn, StateConnected };
enum PhoneEvent { EventNone, EventDialDone, EventAnswered, EventHungUp, EventMissed };
enum PhoneBeep { BeepNone, BeepRing, BeepBusy };
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
    static constexpr uint32_t kRingOutBeatMs = 1000;
    static constexpr uint32_t kRingInMs = 20000;
    static constexpr uint32_t kRingInBeatMs = 2000;

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
            if (now >= m_nextBeat && now < m_phaseStart + kRingOutMs)
            {
                m_beep = BeepRing;
                m_nextBeat += kRingOutBeatMs;
            }
            if (now >= m_phaseStart + kRingOutMs)
            {
                m_state = StateDialed;
                event = EventDialDone;
            }
        }
        else if (m_state == StateRingingIn)
        {
            if (now >= m_nextBeat)
            {
                m_beep = BeepRing;
                m_nextBeat += kRingInBeatMs;
            }
            if (now >= m_phaseStart + kRingInMs)
            {
                m_state = StateLowered;
                event = EventMissed;
            }
        }
        int number = 0;
        for (char c : m_digits)
        {
            number = number * 10 + (c - '0');
        }
        return PhoneView{m_state, now < m_litUntil ? 1 : 0, m_slid && now - m_slideStart < kSlideMs ? 1 : 0,
                         static_cast<int>(m_digits.size()), number, event};
    }

    /** @brief Starts an incoming ring. Ignored unless the phone is lowered. */
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
            m_state = StateRaised;
            m_beep = BeepBusy;
            Light(now);
        }
        else if (result == ResultOver && (m_state == StateDialed || m_state == StateConnected))
        {
            Lower(now);
        }
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
                m_nextBeat = now + kRingOutBeatMs;
                m_beep = BeepRing;
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
        StartSlide(now);
    }

    PhoneState m_state = StateLowered;
    PhoneBeep m_beep = BeepNone;
    std::string m_digits;
    uint32_t m_litUntil = 0;
    uint32_t m_phaseStart = 0;
    uint32_t m_nextBeat = 0;
    uint32_t m_slideStart = 0;
    bool m_slid = false;
};
