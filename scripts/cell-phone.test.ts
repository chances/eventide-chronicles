const sourcePath = new URL("../lib/threads/cellphone.txt", import.meta.url);
const mainPath = new URL("../main.txt", import.meta.url);
const probePath = new URL("../tests/phone-probe.txt", import.meta.url);
const decode = async (url: URL) => new TextDecoder("windows-1252").decode(await Deno.readFile(url));

Deno.test("main.txt includes the phone header, layout, and thread, and starts the thread", async () => {
  const main = await decode(mainPath);
  for (
    const include of [
      "{$INCLUDE lib/phone.txt}",
      "{$INCLUDE lib/threads/cellphone-layout.txt}",
      "{$INCLUDE lib/threads/cellphone.txt}",
      "start_new_script @CellPhone",
    ]
  ) {
    if (!main.includes(include)) throw new Error(`main.txt must contain ${include}`);
  }
});

Deno.test("The phone thread forwards P and calls the tick opcode", async () => {
  const source = await decode(sourcePath);
  if (!source.includes("Pad.IsKeyPressed(KeyCode.P)")) throw new Error("The phone must toggle on P");
  if (!source.includes("0B40:")) throw new Error("The thread must call the tick opcode");
});

Deno.test("The phone thread loads every texture that deno task render-phone writes", async () => {
  const source = await decode(sourcePath);
  const sizes = await Deno.readTextFile(new URL("../dist/phone/sizes.csv", import.meta.url)).catch(() => null);
  if (sizes === null) return; // dist/ is not built on a fresh checkout
  const names = sizes.trim().split("\n").slice(1).map((row) => row.split(",")[0]);
  const missing = names.filter((name) => !source.includes(`'${name}')`));
  if (missing.length > 0) throw new Error(`cellphone.txt does not load ${missing.join(", ")}`);
});

Deno.test("Every sprite the phone draws uses the slot that holds its own texture", async () => {
  const source = (await decode(sourcePath)).replaceAll("\r\n", "\n");
  const loaded = new Map<number, string>();
  for (const [, slot, name] of source.matchAll(/Txd\.LoadSprite\((\d+), '(\w+)'\)/g)) {
    loaded.set(Number(slot), name);
  }
  if (loaded.size !== 61) throw new Error(`The thread loads ${loaded.size} sprites, not 61`);
  // The digit glyphs: slots 50 to 59 hold dig0 to dig9, and 60 holds the dash
  for (let digit = 0; digit <= 9; digit++) {
    if (loaded.get(50 + digit) !== `dig${digit}`) throw new Error(`Slot ${50 + digit} must hold dig${digit}`);
  }
  if (loaded.get(60) !== "digdsh") throw new Error("Slot 60 must hold digdsh");
  if (loaded.get(61) !== "digcol") throw new Error("Slot 61 must hold digcol");
  if (!/\$PSlot = 50\r?\n\s*\$PSlot \+= \$TDigit/.test(source)) throw new Error("The digit loop must draw slot 50 plus the digit");

  const draws = [
    ...source.matchAll(
      /\$PSlot = (\d+)\n(\$PSlot \+= \$PhoneLit\n)?(?:if\n\s+\$PhoneHeld == \d\nthen\n\s+\$PSlot = (\d+)\nend\n)?\$PX = PH_(\w+)_X/g,
    ),
  ];
  if (draws.length !== 18) throw new Error(`Expected 18 sprite draws, found ${draws.length}`);
  const textureOf = (part: string) => {
    if (part === "BODY") return "body";
    if (part === "SOFTL" || part === "SOFTR") return "soft";
    if (part === "KST") return "keyst";
    if (part === "KHS") return "keyhs";
    if (/^K\d$/.test(part)) return `key${part[1]}`;
    return part.toLowerCase();
  };
  for (const [, slot, lit, pressed, part] of draws) {
    const texture = textureOf(part);
    const unlit = texture === "body" ? "body" : `${texture}_u`;
    if (loaded.get(Number(slot)) !== unlit) {
      throw new Error(`${part} draws slot ${slot}, which holds ${loaded.get(Number(slot))}, not ${unlit}`);
    }
    if (lit && loaded.get(Number(slot) + 1) !== `${texture}_l`) {
      throw new Error(`${part} lit slot ${Number(slot) + 1} does not hold ${texture}_l`);
    }
    if (pressed && loaded.get(Number(pressed)) !== `${texture}_p`) {
      throw new Error(`${part} pressed slot ${pressed} does not hold ${texture}_p`);
    }
  }
});

Deno.test("The phone probe includes the real thread and the same header", async () => {
  const probe = await decode(probePath);
  for (const include of ["../lib/phone.txt", "../lib/threads/cellphone-layout.txt", "../lib/threads/cellphone.txt"]) {
    if (!probe.includes(`{$INCLUDE ${include}}`)) throw new Error(`phone-probe.txt must include ${include}`);
  }
});
