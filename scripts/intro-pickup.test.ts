const missionSourcePath = new URL("../main.txt", import.meta.url);

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
