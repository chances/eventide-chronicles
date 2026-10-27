const mainPath = new URL("../main.txt", import.meta.url);

Deno.test("Package tracker toggles with O, leaving P and Q free", async () => {
  const source = new TextDecoder("windows-1252").decode(
    await Deno.readFile(mainPath),
  );
  const start = source.indexOf("// --- TRACKER TOGGLE CONTROLS ---");
  const end = source.indexOf("\nwait 250", start);

  if (start < 0 || end < 0) {
    throw new Error("Tracker toggle block boundaries were not found");
  }

  const block = source.slice(start, end);
  if (block.includes("KeyCode.P") || block.includes("KeyCode.Q")) {
    throw new Error("The tracker block must not read P or Q");
  }
  if (!block.includes("Pad.IsKeyPressed(KeyCode.O)")) {
    throw new Error("The tracker must toggle with O");
  }
});
