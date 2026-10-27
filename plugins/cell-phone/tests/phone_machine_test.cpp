#include "phone_machine.h"

#include <cstdio>

#define CHECK(condition)                                                              \
    do                                                                                \
    {                                                                                 \
        if (!(condition))                                                             \
        {                                                                             \
            std::fprintf(stderr, "FAILED %s:%d: %s\n", __FILE__, __LINE__, #condition); \
            return 1;                                                                 \
        }                                                                             \
    } while (0)

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
        CHECK(m.TakeBeep() == BeepRing);
        CHECK(Tick(m, 3999).event == EventNone);
        PhoneView v = Tick(m, 4000);
        CHECK(v.state == StateDialed && v.event == EventDialDone && v.number == 5557653);
        m.Resolve(4100, ResultBusy);
        CHECK(m.TakeBeep() == BeepBusy);
        v = Tick(m, 4200);
        CHECK(v.state == StateRaised && v.digitCount == 7);
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
    return 0;
}
