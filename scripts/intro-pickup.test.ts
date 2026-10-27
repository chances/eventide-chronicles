// main.txt includes the Intro mission from missions/intro.txt
const missionSourcePath = new URL("../missions/intro.txt", import.meta.url);

Deno.test("Intro death retry recreates the bat pickup", async () => {
  const source = new TextDecoder("windows-1252").decode(
    await Deno.readFile(missionSourcePath),
  );
  const handlerStart = source.indexOf(":Intro_1666");
  const handlerEnd = source.indexOf("\n:Intro_1667", handlerStart);

  if (handlerStart < 0 || handlerEnd < 0) {
    throw new Error("Intro death handler boundaries were not found");
  }

  const handler = source.slice(handlerStart, handlerEnd);
  const removeIndex = handler.indexOf("Pickup.Remove($GUN_BEACH1)");
  const createIndex = handler.indexOf(
    "$GUN_BEACH1 = Pickup.Create(#BAT, PickupType.OnStreet,",
  );

  if (removeIndex < 0 || createIndex < 0 || removeIndex > createIndex) {
    throw new Error(
      "Intro death handler must replace the old bat pickup before retry",
    );
  }
});

Deno.test("Intro gives and equips the bat instead of waiting for a pickup", async () => {
  const source = new TextDecoder("windows-1252").decode(
    await Deno.readFile(missionSourcePath),
  );
  const stepStart = source.indexOf(":Intro_1130");
  const stepEnd = source.indexOf(":Intro_1145", stepStart);

  if (stepStart < 0 || stepEnd < 0) {
    throw new Error("Intro bat step boundaries were not found");
  }

  const step = source.slice(stepStart, stepEnd);
  const giveIndex = step.indexOf(
    "Player.GiveWeapon($PLAYER1, WeaponType.BaseballBat, 1)",
  );
  const equipIndex = step.indexOf(
    "Player.SetCurrentWeapon($PLAYER1, WeaponType.BaseballBat)",
  );

  if (giveIndex < 0 || equipIndex < giveIndex) {
    throw new Error("Intro must give the bat and then equip it");
  }

  for (const waitsOnPickup of ["Pickup.HasBeenCollected", "RemoveAllWeapons"]) {
    if (step.includes(waitsOnPickup)) {
      throw new Error(`The bat step must not use ${waitsOnPickup}`);
    }
  }
});

Deno.test("Intro stops the car destruction countdown when the car is destroyed", async () => {
  const source = new TextDecoder("windows-1252").decode(
    await Deno.readFile(missionSourcePath),
  );
  const countdownStart = source.indexOf(":Intro_1460");
  const countdownEnd = source.indexOf(":Intro_1665", countdownStart);
  const passStart = source.indexOf(":Intro_1450");
  const passEnd = source.indexOf(":Intro_1460", passStart);

  if (countdownStart < 0 || countdownEnd < 0 || passStart < 0 || passEnd < 0) {
    throw new Error("Intro countdown and pass boundaries were not found");
  }

  const countdown = source.slice(countdownStart, countdownEnd);
  if (countdown.includes("wait 60000")) {
    throw new Error("The countdown must poll the car, not sleep through it");
  }

  const pass = source.slice(passStart, passEnd);
  const clears = pass.split("Hud.ClearTimer($TIMER)").length - 1;
  const passBranches =
    pass.split("Stat.RegisterMissionPassed('ITBEG')").length -
    1;
  if (passBranches < 2 || clears < passBranches) {
    throw new Error("Every Intro pass branch must clear the countdown timer");
  }
});
