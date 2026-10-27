/**
 * @file cell-phone.cpp
 * @brief CLEO plugin for the Eventide Chronicles cell phone, Vice City.
 *
 * Wraps the PhoneMachine state machine in three opcodes. Beep playback is not built yet, so the
 * machine's beep requests are drained and dropped.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include "VC.CLEO.h"
#include "phone_machine.h"

#define CLEO_VERSION_MAIN 2
#define CLEO_VERSION_MAJOR 1
#define CLEO_VERSION_MINOR 0
#define CLEO_VERSION ((CLEO_VERSION_MAIN << 24) | (CLEO_VERSION_MAJOR << 16) | (CLEO_VERSION_MINOR << 8))

/** @brief Pointer to the CLEO parameter buffer shared with the calling script. */
static tScriptVar *Params;

static PhoneMachine g_phone;

/**
 * @brief Opcode 0B40: run one frame of the phone.
 *
 * Inputs: key code, blocked flag. Outputs: state, lit, animating, digit count, number, event.
 */
eOpcodeResult WINAPI OPCODE_0B40(CScript *script)
{
    script->Collect(2);
    const int key = Params[0].nVar;
    const bool blocked = Params[1].nVar != 0;
    const PhoneView view = g_phone.Tick(GetTickCount(), key, blocked);
    g_phone.TakeBeep();
    Params[0].nVar = view.state;
    Params[1].nVar = view.lit;
    Params[2].nVar = view.animating;
    Params[3].nVar = view.digitCount;
    Params[4].nVar = view.number;
    Params[5].nVar = view.event;
    script->Store(6);
    return OR_CONTINUE;
}

/** @brief Opcode 0B41: start an incoming call. */
eOpcodeResult WINAPI OPCODE_0B41(CScript *script)
{
    g_phone.RingIncoming(GetTickCount());
    g_phone.TakeBeep();
    return OR_CONTINUE;
}

/** @brief Opcode 0B42: report the outcome of a dialed number, or end a call. Input: result. */
eOpcodeResult WINAPI OPCODE_0B42(CScript *script)
{
    script->Collect(1);
    g_phone.Resolve(GetTickCount(), Params[0].nVar);
    g_phone.TakeBeep();
    return OR_CONTINUE;
}

/** @brief DLL_PROCESS_ATTACH checks the CLEO version, caches the parameter buffer, and registers opcodes 0B40 to 0B42. */
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID lpReserved)
{
    if (reason == DLL_PROCESS_ATTACH)
    {
        if (CLEO_GetVersion() < CLEO_VERSION)
        {
            MessageBox(HWND_DESKTOP, "An incorrect version of CLEO was loaded.", "cell-phone.cleo", MB_ICONERROR);
            return FALSE;
        }
        Params = CLEO_GetParamsAddress();
        Opcodes::RegisterOpcode(0x0B40, OPCODE_0B40);
        Opcodes::RegisterOpcode(0x0B41, OPCODE_0B41);
        Opcodes::RegisterOpcode(0x0B42, OPCODE_0B42);
    }
    return TRUE;
}
