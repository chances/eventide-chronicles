#include "phone_machine.h"

#include "check.h"

static PhoneView Tick(PhoneMachine &m, uint32_t now, int key = KeyNone, bool blocked = false)
{
    return m.Tick(now, key, blocked);
}

static void TypeNumber(PhoneMachine &m, uint32_t now, const char *digits)
{
    for (const char *d = digits; *d; ++d)
    {
        Tick(m, now, *d - '0');
    }
}

int main()
{
    {
        PhoneMachine m;
        CHECK(Tick(m, 0).state == StateLowered);
        PhoneView v = Tick(m, 0, KeyToggle);
        CHECK(v.state == StateRaised && v.animating == 1 && v.lit == 1);
        CHECK(Tick(m, 549).animating == 1);
        CHECK(Tick(m, 550).animating == 0);
        CHECK(Tick(m, 600, KeyToggle).state == StateLowered);
    }
    {
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        TypeNumber(m, 100, "55576539");
        PhoneView v = Tick(m, 100);
        CHECK(v.digitCount == 7 && v.number == 5557653);
        CHECK(Tick(m, 100, KeyBackspace).digitCount == 6);
    }
    {
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        TypeNumber(m, 100, "5557653");
        CHECK(Tick(m, 1000, KeyDial).state == StateRingingOut);
        // The ringback starts kRingbackDelayMs after the dial, once, and the dial ends after kRingOutMs
        CHECK(m.TakeBeep() == BeepNone);
        CHECK(Tick(m, 1000 + kRingbackDelayMs - 1).state == StateRingingOut && m.TakeBeep() == BeepNone);
        CHECK(Tick(m, 1000 + kRingbackDelayMs).state == StateRingingOut && m.TakeBeep() == BeepRingback);
        CHECK(Tick(m, 3999).event == EventNone && m.TakeBeep() == BeepNone);
        PhoneView v = Tick(m, 4000);
        CHECK(v.state == StateDialed && v.event == EventDialDone && v.number == 5557653);
        // A busy number connects, is quiet for kBusyDelayMs, plays the busy tone for kBusyToneMs, then returns to entry
        const uint32_t toneAt = 4100 + PhoneMachine::kBusyDelayMs;
        const uint32_t endAt = toneAt + PhoneMachine::kBusyToneMs;
        m.Resolve(4100, ResultBusy);
        CHECK(m.TakeBeep() == BeepNone);
        CHECK(Tick(m, 4200).state == StateConnected);
        CHECK(Tick(m, toneAt - 1).state == StateConnected && m.TakeBeep() == BeepNone);
        CHECK(Tick(m, toneAt).state == StateConnected && m.TakeBeep() == BeepBusy);
        CHECK(Tick(m, endAt - 1).state == StateConnected && m.TakeBeep() == BeepNone);
        v = Tick(m, endAt);
        CHECK(v.state == StateRaised && v.digitCount == 0 && v.lit == 1);
    }
    {
        // Hanging up during the busy tone lowers the phone, and the call does not come back
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        TypeNumber(m, 100, "5551234");
        Tick(m, 200, KeyDial);
        Tick(m, 3200);
        m.Resolve(3300, ResultBusy);
        CHECK(Tick(m, 7000, KeyToggle).state == StateLowered);
        CHECK(Tick(m, 20000).state == StateLowered);
    }
    {
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        TypeNumber(m, 100, "5550100");
        Tick(m, 200, KeyDial);
        Tick(m, 3200);
        m.Resolve(3300, ResultConnected);
        CHECK(Tick(m, 3400).state == StateConnected);
        m.Resolve(3500, ResultOver);
        CHECK(Tick(m, 3600).state == StateLowered);
    }
    {
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        Tick(m, 3000, 5);
        CHECK(Tick(m, 7999).lit == 1);
        CHECK(Tick(m, 8000).lit == 0);
    }
    {
        // During a call the backlight times out, and any key press brings it back
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        TypeNumber(m, 100, "5550100");
        Tick(m, 200, KeyDial);
        Tick(m, 3200);
        m.Resolve(3300, ResultConnected);
        CHECK(Tick(m, 3400).state == StateConnected);
        CHECK(Tick(m, 3300 + PhoneMachine::kBacklightMs).lit == 0);
        CHECK(Tick(m, 9000, 5).lit == 1);
        CHECK(Tick(m, 9000 + PhoneMachine::kBacklightMs).lit == 0);
    }
    {
        // A digit key reports its digit once, even when the buffer is full, and other keys report none
        PhoneMachine m;
        CHECK(m.TakeDigit() == -1);
        Tick(m, 0, KeyToggle);
        CHECK(m.TakeDigit() == -1);
        Tick(m, 100, 5);
        CHECK(m.TakeDigit() == 5);
        CHECK(m.TakeDigit() == -1);
        TypeNumber(m, 200, "1234567");
        m.TakeDigit();
        Tick(m, 300, 9);
        CHECK(m.TakeDigit() == 9);
        Tick(m, 400, KeyBackspace);
        CHECK(m.TakeDigit() == -1);
    }
    {
        PhoneMachine m;
        Tick(m, 0, KeyToggle);
        CHECK(Tick(m, 100, KeyNone, true).state == StateLowered);
        CHECK(Tick(m, 200, KeyToggle, true).state == StateLowered);
    }
    {
        PhoneMachine m;
        m.RingIncoming(100);
        CHECK(Tick(m, 200).state == StateRingingIn);
        CHECK(m.TakeBeep() == BeepRing);
        PhoneView v = Tick(m, 300, KeyAnswer);
        CHECK(v.state == StateConnected && v.event == EventAnswered);
        CHECK(Tick(m, 400, KeyEscape).event == EventHungUp);
    }
    {
        PhoneMachine m;
        m.RingIncoming(0);
        CHECK(Tick(m, 19999).state == StateRingingIn);
        PhoneView v = Tick(m, 20000);
        CHECK(v.state == StateLowered && v.event == EventMissed);
    }
    {
        // An incoming ring raises the phone, keeps it lit past the 5 second backlight, and P declines it
        PhoneMachine m;
        m.RingIncoming(0);
        PhoneView v = Tick(m, 1);
        CHECK(v.state == StateRingingIn && v.animating == 1 && v.lit == 1);
        CHECK(Tick(m, 12000).lit == 1);
        v = Tick(m, 12100, KeyToggle);
        CHECK(v.state == StateLowered && v.event == EventDeclined && v.animating == 1);
        CHECK(Tick(m, 12200, KeyAnswer).event == EventNone);
    }
    {
        // A missed call slides the phone away
        PhoneMachine m;
        m.RingIncoming(0);
        PhoneView v = Tick(m, 20000);
        CHECK(v.state == StateLowered && v.event == EventMissed && v.animating == 1);
    }
    return 0;
}
