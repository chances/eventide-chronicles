/// <reference lib="dom" />
import { Image } from "@cross/image";
import { join } from "@std/path";
import puppeteer, { type ElementHandle, type Page } from "puppeteer-core";

// Renders the cell phone parts from docs/specimens/cellphone-mockup.html to PNGs, then packs them into
// dist/phone/phone.txd with import-skin. Each part is shot at 2x with a transparent background and padded
// to a power-of-two canvas at the top left. dist/phone/sizes.csv lists each part's content and texture size.
// Texture names stay within 7 characters: `<part>_u` (unlit), `_l` (lit), `_p` (lit and pressed).
// Uses the browser at CHROME in .env, and downloads nothing.
// Usage: deno task render-phone

const outDir = join("dist", "phone");
const scale = 2;
const pad = 6;

interface Part {
  name: string;
  selector: string;
  states: ("u" | "l" | "p")[];
}

const keyStates: Part["states"] = ["u", "l", "p"];
const parts: Part[] = [
  // The body texture also carries the speaker slot and the LCD frame, so they cost no sprite slots
  { name: "body", selector: ".phone", states: [] },
  { name: "soft", selector: ".key.soft.l", states: keyStates },
  { name: "dpad", selector: ".dpad", states: keyStates },
  { name: "ans", selector: ".key.answer", states: keyStates },
  { name: "hang", selector: ".key.hangup", states: keyStates },
  ...Array.from({ length: 10 }, (_, digit) => ({
    name: `key${digit}`,
    selector: `[data-digit="${digit}"]`,
    states: keyStates,
  })),
  { name: "keyst", selector: `[data-key="*"]`, states: keyStates },
  { name: "keyhs", selector: `[data-key="#"]`, states: keyStates },
];

const executablePath = Deno.env.get("CHROME");
if (!executablePath) {
  console.error("Set CHROME in .env to the path of an installed Chrome.");
  Deno.exit(1);
}

const mockup = new URL("../docs/specimens/cellphone-mockup.html", import.meta.url);

// The mockup slides, fades, and times out its backlight. Freeze all of that so each shot is one stable look.
const freeze = `
  * { transition: none !important; animation: none !important; }
  html, body { background: transparent !important; overflow: visible !important; }
  .screen { overflow: visible !important; border: 0 !important; background: transparent !important; padding: 0 !important; width: auto !important; }
  .phone { transform: none !important; margin: 0 !important; }
`;

const powerOfTwo = (n: number) => 2 ** Math.ceil(Math.log2(n));

// One LCD cell in mockup px: Courier New at 22.4px is 13.44px wide, plus the mockup's 0.1em letter spacing
const glyphCell = { width: 15.68, height: 24 };
const glyphs: [string, string][] = [
  ...Array.from({ length: 10 }, (_, digit): [string, string] => [String(digit), `dig${digit}`]),
  ["-", "digdsh"],
  [":", "digcol"],
];

async function shoot(
  page: Page,
  handle: ElementHandle,
  state: Part["states"][number] | null,
  isBody: boolean,
): Promise<Uint8Array> {
  await page.evaluate((state, isBody) => {
    const phone = document.querySelector(".phone")!;
    phone.classList.toggle("lit", state === "l" || state === "p");
    phone.querySelectorAll(".pressed").forEach((el) => el.classList.remove("pressed"));
    // A part sits over the body in the game, so only the body shot keeps the body's fill.
    phone.setAttribute("data-shot", isBody ? "body" : "part");
    phone.querySelectorAll(".solo").forEach((el) => el.classList.remove("solo"));
  }, state, isBody);
  await handle.evaluate((el) => el.classList.add("solo"));
  const box = await handle.boundingBox();
  if (!box) throw new Error("A part has no box");
  const x = Math.floor(box.x) - pad;
  const y = Math.floor(box.y) - pad;
  const clip = {
    x,
    y,
    width: Math.ceil(box.x + box.width) + pad - x,
    height: Math.ceil(box.y + box.height) + pad - y,
  };
  if (state === "p") {
    await handle.evaluate((el) => el.classList.add("pressed"));
  }
  return await page.screenshot({ clip, omitBackground: true, type: "png" });
}

/** Pads a shot to a power-of-two canvas at the top left, writes it, and records its sizes. */
async function saveTexture(png: Uint8Array, partName: string, textureName: string): Promise<void> {
  const shot = await Image.decode(png);
  const textureWidth = powerOfTwo(shot.width);
  const textureHeight = powerOfTwo(shot.height);
  const canvas = new Uint8Array(textureWidth * textureHeight * 4);
  for (let row = 0; row < shot.height; row++) {
    canvas.set(
      shot.data.subarray(row * shot.width * 4, (row + 1) * shot.width * 4),
      row * textureWidth * 4,
    );
  }
  textureSizes.set(partName, [textureWidth, textureHeight]);
  if (textureName.length > 7) throw new Error(`${textureName} is over 7 characters`);
  const path = join(outDir, `phone_${textureName}.png`);
  await Deno.writeFile(path, await Image.fromRGBA(textureWidth, textureHeight, canvas).encode("png"));
  files.push(path);
  sizes.push(`${textureName},${shot.width},${shot.height},${textureWidth},${textureHeight}`);
}

await Deno.mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const sizes: string[] = ["name,contentWidth,contentHeight,textureWidth,textureHeight"];
const files: string[] = [];
const textureSizes = new Map<string, [number, number]>();
const layout: string[] = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 900, deviceScaleFactor: scale });
  await page.goto(mockup.href);
  await page.addStyleTag({ content: freeze });
  // Stop the backlight timer and the raise animation, then drive the classes by hand
  await page.evaluate(() => {
    (globalThis as unknown as { lower: () => void }).lower();
  });
  await page.addStyleTag({
    content: `
      .phone[data-shot="part"] { background: transparent !important; box-shadow: none !important; }
      /* A neighbor's lip shadow would leak into the padding around the shot */
      .phone[data-shot="part"] .key:not(.solo), .phone[data-shot="part"] .dpad:not(.solo) { visibility: hidden !important; }
      .phone[data-shot="body"] .nav, .phone[data-shot="body"] .keys { visibility: hidden !important; }
    `,
  });

  for (const part of parts) {
    const handle = await page.$(part.selector);
    if (!handle) throw new Error(`No element for ${part.name}: ${part.selector}`);
    const states = part.states.length ? part.states : [null];
    for (const state of states) {
      const png = await shoot(page, handle, state, part.name === "body");
      await saveTexture(png, part.name, state ? `${part.name}_${state}` : part.name);
    }
  }

  // The LCD digits: white glyphs in the mockup's font, which the thread tints through the sprite color.
  // One texture each, so unlit and lit share them.
  await page.addStyleTag({
    content: `
      body > *:not(#glyph) { visibility: hidden !important; }
      #glyph { position: fixed; left: 20px; top: 20px; display: block; width: ${glyphCell.width}px; height: ${glyphCell.height}px;
        line-height: ${glyphCell.height}px; text-align: center; font: 22.4px "Courier New", monospace; color: #fff; }
    `,
  });
  await page.evaluate(() => {
    const glyph = document.createElement("div");
    glyph.id = "glyph";
    document.body.append(glyph);
  });
  const glyphHandle = (await page.$("#glyph"))!;
  for (const [character, textureName] of glyphs) {
    await glyphHandle.evaluate((el, text) => (el.textContent = text), character);
    const box = (await glyphHandle.boundingBox())!;
    const png = await page.screenshot({
      clip: {
        x: Math.floor(box.x) - pad,
        y: Math.floor(box.y) - pad,
        width: Math.ceil(box.width) + 2 * pad,
        height: Math.ceil(box.height) + 2 * pad,
      },
      omitBackground: true,
      type: "png",
    });
    await saveTexture(png, textureName, textureName);
  }

  // Where each placed element sits in the phone box, for the SCM thread. Each sprite quad is the whole
  // power-of-two texture, whose top left is `pad` mockup px up and left of the element's box.
  const placed: { name: string; texture: string; selector: string }[] = [
    { name: "BODY", texture: "body", selector: ".phone" },
    { name: "LCDBOX", texture: "", selector: ".lcd" },
    { name: "SOFTL", texture: "soft", selector: ".key.soft.l" },
    { name: "SOFTR", texture: "soft", selector: ".key.soft.r" },
    { name: "DPAD", texture: "dpad", selector: ".dpad" },
    { name: "ANS", texture: "ans", selector: ".key.answer" },
    { name: "HANG", texture: "hang", selector: ".key.hangup" },
    ...Array.from({ length: 10 }, (_, digit) => ({
      name: `K${digit}`,
      texture: `key${digit}`,
      selector: `[data-digit="${digit}"]`,
    })),
    { name: "KST", texture: "keyst", selector: `[data-key="*"]` },
    { name: "KHS", texture: "keyhs", selector: `[data-key="#"]` },
  ];
  const boxes = await page.evaluate((placed) => {
    // The last shot leaves a pressed key sunk 4 px
    document.querySelectorAll(".pressed").forEach((el) => el.classList.remove("pressed"));
    const phone = document.querySelector(".phone")!.getBoundingClientRect();
    return placed.map(({ selector }) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return [box.left - phone.left, box.top - phone.top, box.width, box.height];
    });
  }, placed);
  const phoneBox = boxes[0];
  layout.push(
    `const PH_W = ${phoneBox[2].toFixed(1)}`,
    `const PH_H = ${phoneBox[3].toFixed(1)}`,
  );
  placed.forEach(({ name, texture }, index) => {
    const [x, y, width, height] = boxes[index];
    // The LCD frame is part of the body texture, and its box only places the digits
    if (name === "LCDBOX") {
      layout.push(
        `const PH_LCDBOX_X = ${x.toFixed(1)}`,
        `const PH_LCDBOX_Y = ${y.toFixed(1)}`,
        `const PH_LCDBOX_W = ${width.toFixed(1)}`,
        `const PH_LCDBOX_H = ${height.toFixed(1)}`,
      );
      return;
    }
    const [textureWidth, textureHeight] = textureSizes.get(texture)!;
    const spriteWidth = textureWidth / scale;
    const spriteHeight = textureHeight / scale;
    layout.push(
      `const PH_${name}_X = ${(x - pad + spriteWidth / 2).toFixed(1)}`,
      `const PH_${name}_Y = ${(y - pad + spriteHeight / 2).toFixed(1)}`,
      `const PH_${name}_W = ${spriteWidth.toFixed(1)}`,
      `const PH_${name}_H = ${spriteHeight.toFixed(1)}`,
    );
  });

  // The LCD digits sit on a grid of equal cells, starting at the LCD's padding edge and centered in its height.
  // A glyph's quad is its whole texture, whose top left is `pad` px up and left of its cell.
  const [lcdX, lcdY, , lcdHeight] = boxes[placed.findIndex(({ name }) => name === "LCDBOX")];
  const [glyphWidth, glyphHeight] = textureSizes.get("dig0")!;
  const quadWidth = glyphWidth / scale;
  const quadHeight = glyphHeight / scale;
  layout.push(
    `const PH_GLYPH_ADV = ${glyphCell.width.toFixed(2)}`,
    `const PH_GLYPH_LEFT = ${(lcdX + 14).toFixed(1)}`,
    `const PH_GLYPH_TOP = ${(lcdY + (lcdHeight - glyphCell.height) / 2).toFixed(1)}`,
    `const PH_GLYPH_CX = ${(quadWidth / 2 - pad).toFixed(1)}`,
    `const PH_GLYPH_CY = ${(quadHeight / 2 - pad).toFixed(1)}`,
    `const PH_GLYPH_W = ${quadWidth.toFixed(1)}`,
    `const PH_GLYPH_H = ${quadHeight.toFixed(1)}`,
  );
} finally {
  await browser.close();
}
await Deno.writeTextFile(
  join("lib", "threads", "cellphone-layout.txt"),
  [
    "// Written by scripts/render-phone-textures.ts from docs/specimens/cellphone-mockup.html. Do not edit.",
    "// Mockup px, measured from the phone box's top left. _X and _Y are a sprite's center, _W and _H its quad.",
    ...layout,
  ].join("\r\n") + "\r\n",
);
await Deno.writeTextFile(join(outDir, "sizes.csv"), sizes.join("\n") + "\n");
console.log(`Rendered ${files.length} textures to ${outDir}`);

const pack = await new Deno.Command("deno", {
  args: ["task", "import-skin", "phone", ...files, "--out", outDir],
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!pack.success) Deno.exit(1);
