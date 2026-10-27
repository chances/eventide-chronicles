import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/csv/parse";

// Checks that skins/outfits.csv and the Clothes thread in main.txt agree: each
// outfit with a store is the model that store's branch gives the player, and
// the outfit in the player slot is the model the game starts in.

// main.txt includes lib/init.txt, where the clothes pickups are created, and lib/threads/clothes.txt, which
// holds the Clothes thread.
const decoder = new TextDecoder("windows-1252");
const source = decoder.decode(await Deno.readFile("main.txt")) +
  decoder.decode(await Deno.readFile("lib/init.txt")) +
  decoder.decode(await Deno.readFile("lib/threads/clothes.txt"));
const outfits = parse(await Deno.readTextFile("skins/outfits.csv"), {
  skipFirstRow: true,
});

// The Clothes thread tests $<Pickup>On, sets it to 1, and dresses the player.
function modelAfterPurchase(pickup: string): string | undefined {
  const bought = source.indexOf(`$${pickup}On = 1`);
  if (bought === -1) return undefined;
  return /Char\.Undress\(\$scplayer, '(\w+)'\)/.exec(
    source.slice(bought),
  )?.[1];
}

for (const outfit of outfits.filter((row) => row.store)) {
  Deno.test(`the ${outfit.store} store gives ${outfit.name}`, () => {
    const pickup = new RegExp(
      `\\$(\\w+) = Pickup\\.CreateClothes\\([^)]*Clothing\\.${outfit.store}\\)`,
    ).exec(source)?.[1];
    assert(pickup, `main.txt has no ${outfit.store} clothes pickup`);
    assertEquals(modelAfterPurchase(pickup), outfit.slot.toUpperCase());
  });
}

Deno.test("the game starts in the outfit that has the player slot", () => {
  const start = /Char\.Undress\(\$scplayer, '(\w+)'\)/.exec(source)?.[1];
  assertEquals(
    start,
    outfits.find((row) => row.slot === "player")?.slot.toUpperCase(),
  );
});

Deno.test("each outfit slot is a real stock clothing model", () => {
  for (const { slot } of outfits) {
    assert(/^(player[2-9]?|play1[0-2])$/.test(slot), `${slot} is not a slot`);
  }
});
