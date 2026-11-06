/**
 * @module
 * Writes the guard of a transition as Gherkin English.
 *
 * A condition is keyed in `./Phrasebook.csv` by its text, or by its command name when it is a call, and a
 * comparison of a boolean flag with 0 or 1 is the flag or its negation. A condition chain is negated and
 * minimized by `logi.js`, and each alternative of the result is written as `When` and `And` lines.
 */
import { createRequire } from "node:module";
import { parse } from "@std/csv";

type Logi = {
  QMC: new () => { solveFromExp(expression: string): { toString(): string }[] };
};

// The ESM entry of logi.js has extensionless re-exports that Deno rejects, so its CJS build is loaded.
const logi = createRequire(new URL("../../deno.json", import.meta.url))(
  "logi.js",
) as Logi;

export type Mode = "single" | "and" | "or";

export type Condition = {
  /** The Phrasebook key: the flag name, the command name, or the condition text. */
  key: string;
  negated: boolean;
  args: string[];
  /** The condition text without leading `not` words. */
  source: string;
};

export type PhraseRow = {
  expression: string;
  nominal: string;
  opposite: string;
  active: string;
};

/** Splits call arguments at commas outside parentheses and quotes. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Reads a condition. `not` words toggle the polarity, and a comparison of a boolean flag (one of `booleans`)
 * with 0, 1, `true`, or `false` becomes the flag with its polarity.
 */
export function parseCondition(
  text: string,
  booleans: ReadonlySet<string>,
): Condition {
  let negated = false;
  let rest = text.trim();
  for (
    let m = rest.match(/^not\s+(.*)$/s);
    m;
    m = rest.match(/^not\s+(.*)$/s)
  ) {
    negated = !negated;
    rest = m[1].trim();
  }
  const compare = rest.match(/^(\$\w+)\s*(==|!=)\s*(0|1|true|false)$/i);
  if (compare && booleans.has(compare[1])) {
    const truthy = ["1", "true"].includes(compare[3].toLowerCase());
    const positive = (compare[2] === "==") === truthy;
    return {
      key: compare[1],
      negated: negated !== !positive,
      args: [],
      source: rest,
    };
  }
  const call = rest.match(/^([A-Za-z_][\w.]*)\((.*)\)$/s);
  if (call) {
    return { key: call[1], negated, args: splitArgs(call[2]), source: rest };
  }
  return { key: rest, negated, args: [], source: rest };
}

/** The rows of `./Phrasebook.csv`, keyed by expression. */
export class Phrasebook {
  readonly #rows: Map<string, PhraseRow>;

  private constructor(rows: Map<string, PhraseRow>) {
    this.#rows = rows;
  }

  static parse(text: string): Phrasebook {
    const rows = parse(text, { skipFirstRow: true }) as PhraseRow[];
    return new Phrasebook(new Map(rows.map((r) => [r.expression, r])));
  }

  static empty(): Phrasebook {
    return new Phrasebook(new Map());
  }

  lookup(key: string): PhraseRow | undefined {
    return this.#rows.get(key);
  }
}

/** The parameter names of every class command in a Sanny Builder library file such as `vc.json`, keyed `Class.Member`. */
export function loadLibrary(path: string): Map<string, string[]> {
  const lib = JSON.parse(Deno.readTextFileSync(path)) as {
    extensions: {
      commands: {
        class?: string;
        member?: string;
        input?: { name: string }[];
      }[];
    }[];
  };
  const out = new Map<string, string[]>();
  for (const ext of lib.extensions) {
    for (const c of ext.commands) {
      if (c.class && c.member && !out.has(`${c.class}.${c.member}`)) {
        out.set(`${c.class}.${c.member}`, (c.input ?? []).map((i) => i.name));
      }
    }
  }
  return out;
}

/** Loads short descriptions of commands from a Sanny Builder library file like `vc.json`. */
export function loadCommandDescriptions(path: string): Map<string, string> {
  const lib = JSON.parse(Deno.readTextFileSync(path)) as {
    extensions: {
      commands: {
        class?: string;
        member?: string;
        name?: string;
        short_desc?: string;
      }[];
    }[];
  };
  const out = new Map<string, string>();
  for (const ext of lib.extensions) {
    for (const c of ext.commands) {
      if (c.short_desc) {
        if (c.class && c.member) {
          out.set(`${c.class}.${c.member}`, c.short_desc);
        }
        if (c.name) {
          out.set(c.name, c.short_desc);
        }
      }
    }
  }
  return out;
}

/**
 * Suggests a phrase for an unphrased condition using compromise 14.19.0.
 * Uses .verbs().toNegative() for the opposite column, and leaves active blank.
 */
export async function suggestPhrase(
  expression: string,
  descriptions: ReadonlyMap<string, string> = new Map(),
): Promise<PhraseRow> {
  const { default: nlp } = await import("compromise");
  const trimmed = expression.trim();
  let clean = trimmed;
  while (clean.toLowerCase().startsWith("not ")) {
    clean = clean.slice(4).trim();
  }

  const callMatch = clean.match(/^([A-Za-z_][\w.]*)\b/);
  const commandKey = callMatch ? callMatch[1] : clean;
  const desc = descriptions.get(commandKey);

  let nominal = "";
  if (desc) {
    let text = desc.trim();
    text = text.replace(
      /^(Checks if|Checks whether|Returns true if|Returns whether)\s+/i,
      "",
    );
    if (text.length > 0 && !text.startsWith("I") && !text.startsWith("GTA")) {
      text = text.charAt(0).toLowerCase() + text.slice(1);
    }
    text = text.replace(/\.$/, "");
    nominal = text;
  } else {
    const cmpMatch = clean.match(/^(\$\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)$/i);
    if (cmpMatch) {
      const varName = cmpMatch[1];
      const op = cmpMatch[2];
      const val = cmpMatch[3].trim().toLowerCase();
      if (
        (op === "==" && (val === "1" || val === "true")) ||
        (op === "!=" && val === "0")
      ) {
        nominal = `${varName} is set`;
      } else if (
        (op === "==" && (val === "0" || val === "false")) ||
        (op === "!=" && val === "1")
      ) {
        nominal = `${varName} is 0`;
      } else {
        nominal = `${varName} ${op} ${cmpMatch[3].trim()}`;
      }
    } else {
      nominal = clean;
    }
  }

  const doc = nlp(nominal);
  doc.verbs().toNegative();
  let opposite = doc.text();
  if (!opposite || opposite === nominal) {
    opposite = `not ${nominal}`;
  }

  return {
    expression: trimmed,
    nominal,
    opposite,
    active: "",
  };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Literal = { letter: string; negated: boolean };

export type GuardText = { text: string; unphrased: string[] };

export class GuardWriter {
  readonly #book: Phrasebook;
  readonly #booleans: ReadonlySet<string>;
  readonly #library: ReadonlyMap<string, string[]>;

  constructor(
    book: Phrasebook,
    booleans: ReadonlySet<string>,
    library: ReadonlyMap<string, string[]> = new Map(),
  ) {
    this.#book = book;
    this.#booleans = booleans;
    this.#library = library;
  }

  /** The guard of a jump taken when the `mode` chain of `conditions` is true, or false when `negated`. */
  write(mode: Mode, conditions: string[], negated: boolean): GuardText {
    const parsed = conditions.map((c) => parseCondition(c, this.#booleans));
    const atoms = new Map<string, { letter: string; condition: Condition }>();
    const literals: Literal[] = parsed.map((condition) => {
      const id = `${condition.key}\0${condition.args.join(",")}`;
      if (!atoms.has(id)) {
        if (atoms.size >= LETTERS.length) {
          throw new Error(`more than ${LETTERS.length} distinct conditions`);
        }
        atoms.set(id, { letter: LETTERS[atoms.size], condition });
      }
      return { letter: atoms.get(id)!.letter, negated: condition.negated };
    });
    const symbol = (l: Literal) => `${l.negated ? "~" : ""}${l.letter}`;
    let expression = literals.map(symbol).join(mode === "or" ? "+" : "");
    if (negated) {
      expression = literals.length === 1
        ? symbol({ ...literals[0], negated: !literals[0].negated })
        : `~(${expression})`;
    }
    const minimized = new logi.QMC().solveFromExp(expression)[0].toString();
    const alternatives = minimized.split(" + ").map((product) =>
      product.split(" * ").map((token): Literal => {
        const match = token.trim().match(/^(~?)([A-Z])$/);
        if (!match) {
          throw new Error(
            `cannot write ${JSON.stringify(minimized)} as a guard`,
          );
        }
        return { letter: match[2], negated: match[1] === "~" };
      }).sort((a, b) => a.letter.localeCompare(b.letter))
    ).sort((a, b) => a[0].letter.localeCompare(b[0].letter));
    const byLetter = new Map(
      [...atoms.values()].map((a) => [a.letter, a.condition]),
    );
    const unphrased = new Set<string>();
    const lines: string[] = [];
    for (const alternative of alternatives) {
      alternative.forEach((literal, i) => {
        const condition = byLetter.get(literal.letter)!;
        const keyword = i === 0 ? "When" : "And";
        lines.push(
          `${keyword} ${
            this.#phrase(condition, literal.negated, i === 0, unphrased)
          }`,
        );
      });
    }
    return { text: lines.join("\n"), unphrased: [...unphrased] };
  }

  #phrase(
    condition: Condition,
    negated: boolean,
    event: boolean,
    unphrased: Set<string>,
  ): string {
    const row = this.#book.lookup(condition.key);
    if (!row) {
      unphrased.add(condition.key);
      return `${negated ? "not " : ""}${condition.source}`;
    }
    const phrase = negated
      ? row.opposite
      : (event && row.active ? row.active : row.nominal);
    const args = this.#arguments(condition);
    return args ? `${phrase} ${args}` : phrase;
  }

  /** The arguments with their library names, points and radii grouped, and the instance argument dropped. */
  #arguments(condition: Condition): string {
    const names = this.#library.get(condition.key);
    if (!names || condition.args.length === 0) return "";
    const parts: (string | { group: "point" | "radius"; values: string[] })[] =
      [];
    const groups = new Map<
      string,
      { group: "point" | "radius"; values: string[] }
    >();
    names.forEach((name, i) => {
      const value = condition.args[i];
      if (name === "self" || value === undefined) return;
      const group: "point" | "radius" | undefined = /^[xyz]$/.test(name)
        ? "point"
        : /^[xyz]Radius$/.test(name)
        ? "radius"
        : undefined;
      if (!group) return void parts.push(`${name} ${value}`);
      if (!groups.has(group)) {
        const created = { group, values: [] as string[] };
        groups.set(group, created);
        parts.push(created);
      }
      groups.get(group)!.values.push(value);
    });
    return parts.map((p) =>
      typeof p === "string"
        ? p
        : `${p.group === "radius" ? "radius " : ""}(${p.values.join(", ")})`
    ).join(", ");
  }
}
