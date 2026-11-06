// Thread and mission graph of a Sanny Builder program, built breadth first from its first script.
// The program is parsed with the tree-sitter-gta3 grammar (a wasm build), with {$INCLUDE} lines expanded.
import { existsSync } from "@std/fs";
import { basename, dirname, join, relative } from "@std/path";
import { Language, type Node, Parser, type Tree } from "web-tree-sitter";

export type Position = { file: string; line: number };

export type EdgeKind =
  | "start_new_script"
  | "launch_mission"
  | "stream_custom_script"
  | "terminate_by_name"
  | "terminate_custom_thread"
  | "terminate_this_script";

export type Edge = {
  kind: EdgeKind;
  /** Label, mission number, script file, or script name the edge points at. */
  target?: string;
  /** True when a start_new_script edge points at its own thread. */
  self?: true;
  label: string;
  at: Position;
};

export type FlagUse = {
  var: string;
  access: "declare" | "read" | "write";
  /** The assigned expression for a write, led by its operator when that is not `=`. */
  value?: string;
};

export type FlagAccess = FlagUse & { label: string; at: Position };

export type OutlineStatement =
  | { kind: string; line: number; text: string }
  | {
    kind: "if";
    line: number;
    mode: "single" | "and" | "or";
    conditions: string[];
    then: OutlineStatement[];
    else?: OutlineStatement[];
  }
  | {
    kind: "if_goto";
    line: number;
    mode: "single" | "and" | "or";
    conditions: string[];
    target: string;
  }
  | { kind: "while"; line: number; condition: string; body: OutlineStatement[] }
  | {
    kind: "repeat";
    line: number;
    condition: string;
    body: OutlineStatement[];
  };

export type OutlineBlock = {
  label: string;
  at: Position;
  statements: OutlineStatement[];
};

export type GraphNode = {
  id: string;
  level: number;
  kind: "main" | "thread" | "mission" | "cleo";
  name: string;
  entry: Position & { label: string };
  mission?: number;
  parents: string[];
  labels: string[];
  edges: Edge[];
  flags: FlagAccess[];
  outline?: OutlineBlock[];
};

export type ScriptName = {
  name: string;
  label: string;
  at: Position;
  status: "entry" | "reached" | "unreached";
};

export type Unresolved = {
  from: string;
  kind: string;
  target: string;
  at: Position;
};

export type GraphData = {
  entry: string;
  trackedVars: string[];
  parseErrors: Position[];
  missingIncludes: Position[];
  missions: {
    number: number;
    label: string;
    at: Position;
    resolved: boolean;
  }[];
  nodes: GraphNode[];
  scriptNames: ScriptName[];
  unresolved: Unresolved[];
  flagUses: (FlagUse & Position)[];
};

export type GraphOptions = {
  /** Variables whose reads and writes are recorded, such as `$ONMISSION`. */
  trackedVars: string[];
  /** Entry labels whose reachable statements are recorded in full. */
  outline: string[];
  /** Folders, relative to the entry file's folder, that hold streamed CLEO script sources. */
  cleoDirs: string[];
};

/** The block of statements before a program's first label. */
export const START = "#start";
const COMMENTS = new Set(["comment", "block_comment"]);
const ASSIGN_OPS = ["=", "+=", "-=", "*=", "/="];

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();
const normalize = (node: Node): string => squash(node.text);
const unquote = (text: string): string => text.replace(/^["']|["']$/g, "");
const labelOf = (node: Node): string =>
  node.namedChildren.find((c) => c.type === "label_ref")!.text.slice(1);

function* walk(node: Node): Generator<Node> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

function ifParts(node: Node) {
  let mode: "single" | "and" | "or" = "single";
  const conditions: Node[] = [];
  const then: Node[] = [];
  const otherwise: Node[] = [];
  let gotoFalse: Node | null = null;
  let hasElse = false;
  let phase: "condition" | "then" | "else" = "condition";
  for (const child of node.children) {
    if (phase === "condition") {
      if (child.type === "and" || child.type === "or") mode = child.type;
      else if (child.type === "condition") conditions.push(child);
      else if (child.type === "then") phase = "then";
      else if (child.type === "goto_if_false_statement") gotoFalse = child;
    } else if (child.type === "else") {
      phase = "else";
      hasElse = true;
    } else if (child.isNamed && !COMMENTS.has(child.type)) {
      (phase === "then" ? then : otherwise).push(child);
    }
  }
  return { mode, conditions, then, otherwise, hasElse, gotoFalse };
}

function endsFlow(node: Node): boolean {
  switch (node.type) {
    case "goto_statement":
    case "terminate_script":
    case "return_statement":
      return true;
    case "if_statement": {
      const parts = ifParts(node);
      return parts.hasElse && divergesAfter(parts.then) &&
        divergesAfter(parts.otherwise);
    }
    case "while_loop": {
      const condition = node.children.find((c) => c.type === "condition");
      return condition !== undefined && normalize(condition) === "true" &&
        ![...walk(node)].some((n) => n.type === "break_statement");
    }
    default:
      return false;
  }
}

/** True when the last statement of the list never lets control fall out of it. */
function divergesAfter(statements: Node[]): boolean {
  const last = statements.findLast((s) => !COMMENTS.has(s.type));
  return last !== undefined && endsFlow(last);
}

export function outlineOf(node: Node): OutlineStatement {
  const line = node.startPosition.row + 1;
  const kids = (list: Node[]) =>
    list.filter((n) => n.isNamed && !COMMENTS.has(n.type));
  const body = (list: Node[]) => kids(list).map(outlineOf);
  switch (node.type) {
    case "if_statement": {
      const parts = ifParts(node);
      return {
        kind: "if",
        line,
        mode: parts.mode,
        conditions: parts.conditions.map(normalize),
        then: body(parts.then),
        ...(parts.hasElse ? { else: body(parts.otherwise) } : {}),
      };
    }
    case "conditional_goto": {
      const parts = ifParts(node);
      return {
        kind: "if_goto",
        line,
        mode: parts.mode,
        conditions: parts.conditions.map(normalize),
        target: parts.gotoFalse ? labelOf(parts.gotoFalse) : "",
      };
    }
    case "while_loop": {
      const items = kids(node.children);
      return {
        kind: "while",
        line,
        condition: normalize(items[0]),
        body: items.slice(1).map(outlineOf),
      };
    }
    case "repeat_loop": {
      const items = kids(node.children);
      return {
        kind: "repeat",
        line,
        condition: normalize(items[items.length - 1]),
        body: items.slice(0, -1).map(outlineOf),
      };
    }
    default:
      return { kind: node.type, line, text: normalize(node) };
  }
}

/** How a tracked global variable is used at `node`, or null when the use is not an access. */
function classifyFlag(node: Node): FlagUse | null {
  const parent = node.parent;
  if (node.type !== "global_var" || !parent) return null;
  if (parent.type === "var_declaration" || parent.type === "alloc_statement") {
    return null;
  }
  if (parent.type === "declare_mission_flag") {
    return { var: node.text, access: "declare" };
  }
  if (parent.type === "assignment") {
    const op = parent.children.find((c) => ASSIGN_OPS.includes(c.type))!;
    if (node.startIndex < op.startIndex) {
      const value = squash(parent.text.slice(op.endIndex - parent.startIndex));
      return {
        var: node.text,
        access: "write",
        value: op.type === "=" ? value : `${op.type} ${value}`,
      };
    }
  }
  return { var: node.text, access: "read" };
}

type Stmt = { node: Node; file: string };
type Block = {
  label: string;
  at: Position;
  stmts: Stmt[];
  next: string | null;
  index: number;
};

const parsers = new Map<string, Promise<Parser>>();
function parserFor(wasm: string): Promise<Parser> {
  let parser = parsers.get(wasm);
  if (!parser) {
    parser = (async () => {
      await Parser.init();
      const created = new Parser();
      created.setLanguage(await Language.load(wasm));
      return created;
    })();
    parsers.set(wasm, parser);
  }
  return parser;
}

/** One script file with its {$INCLUDE} lines expanded, split into label blocks. */
export class SourceProgram {
  readonly root: string;
  readonly parseErrors: Position[] = [];
  readonly missingIncludes: Position[] = [];
  readonly missions = new Map<number, { label: string; at: Position }>();
  readonly trees: { file: string; tree: Tree }[] = [];
  readonly blocks = new Map<string, Block>();
  readonly #byLowerCase = new Map<string, string>();
  readonly #parser: Parser;
  #last: Block;

  private constructor(root: string, parser: Parser) {
    this.root = root;
    this.#parser = parser;
    this.#last = {
      label: START,
      at: { file: "", line: 1 },
      stmts: [],
      next: null,
      index: 0,
    };
    this.blocks.set(START, this.#last);
  }

  /** `root` is the folder that displayed paths and {$INCLUDE} lines are relative to; it defaults to the entry's folder. */
  static async load(
    entry: string,
    wasm: string,
    root = dirname(entry),
  ): Promise<SourceProgram> {
    const program = new SourceProgram(root, await parserFor(wasm));
    program.#last.at.file = program.display(entry);
    await program.#flatten(entry);
    return program;
  }

  display(path: string): string {
    return relative(this.root, path).replaceAll("\\", "/");
  }

  async #flatten(path: string): Promise<void> {
    const file = this.display(path);
    const text = new TextDecoder("windows-1252").decode(
      await Deno.readFile(path),
    );
    const tree = this.#parser.parse(text);
    if (!tree) throw new Error(`parse failed: ${path}`);
    this.trees.push({ file, tree });
    for (const node of walk(tree.rootNode)) {
      if (node.isError || node.isMissing) {
        this.parseErrors.push({ file, line: node.startPosition.row + 1 });
      }
    }
    for (const child of tree.rootNode.children) {
      if (!child.isNamed || COMMENTS.has(child.type)) continue;
      const at = { file, line: child.startPosition.row + 1 };
      if (child.type === "include_directive") {
        const target = child.namedChildren.find((c) =>
          c.type === "include_path"
        )?.text ?? "";
        const found = [join(this.root, target), join(dirname(path), target)]
          .find((p) => existsSync(p));
        if (found) await this.#flatten(found);
        else this.missingIncludes.push(at);
      } else if (child.type === "header_directive") {
        this.#collectMissions(child, file);
      } else if (child.type === "label") {
        const name = child.namedChildren.find((c) =>
          c.type === "identifier"
        )!.text;
        const block: Block = {
          label: name,
          at,
          stmts: [],
          next: null,
          index: this.blocks.size,
        };
        this.#last.next = name;
        this.blocks.set(name, block);
        this.#byLowerCase.set(name.toLowerCase(), name);
        this.#last = block;
      } else {
        this.#last.stmts.push({ node: child, file });
      }
    }
  }

  #collectMissions(header: Node, file: string) {
    for (const node of walk(header)) {
      if (node.type !== "mission_definition") continue;
      const number = Number(
        node.namedChildren.find((c) => c.type === "integer")!.text,
      );
      this.missions.set(number, {
        label: labelOf(node),
        at: { file, line: node.startPosition.row + 1 },
      });
    }
  }

  /** The label as declared, for a reference in any letter case; the compiler matches labels without regard to case. */
  resolve(name: string): string | undefined {
    return name === START ? START : this.#byLowerCase.get(name.toLowerCase());
  }

  /** Labels reachable from `entry` by goto, gosub, calls, and fall-through, in program order. */
  reach(
    entry: string,
    onUnresolved?: (kind: string, target: string, at: Position) => void,
  ): string[] {
    const seen = new Set<string>();
    const stack = [entry];
    while (stack.length) {
      const label = stack.pop()!;
      const block = this.blocks.get(label);
      if (!block || seen.has(label)) continue;
      seen.add(label);
      for (const { node, file } of block.stmts) {
        for (const n of walk(node)) {
          let target: string | null = null;
          let kind = "";
          if (
            n.type === "goto_statement" ||
            n.type === "goto_if_false_statement" || n.type === "gosub_statement"
          ) {
            target = labelOf(n);
            kind = n.type === "gosub_statement" ? "gosub" : "goto";
          } else if (
            n.type === "function_call" &&
            n.firstNamedChild?.type === "identifier"
          ) {
            const name = this.resolve(n.firstNamedChild.text);
            if (name !== undefined) [target, kind] = [name, "call"];
          }
          if (target === null) continue;
          const resolved = this.resolve(target);
          if (resolved !== undefined) stack.push(resolved);
          else {onUnresolved?.(kind, target, {
              file,
              line: n.startPosition.row + 1,
            });}
        }
      }
      if (block.next && !divergesAfter(block.stmts.map((s) => s.node))) {
        stack.push(block.next);
      }
    }
    return [...seen].sort((a, b) =>
      this.blocks.get(a)!.index - this.blocks.get(b)!.index
    );
  }

  /** Names of the global variables that appear anywhere in the expanded program. */
  globalVars(): string[] {
    const names = new Set<string>();
    for (const { tree } of this.trees) {
      for (const n of walk(tree.rootNode)) {
        if (n.type === "global_var") names.add(n.text);
      }
    }
    return [...names];
  }

  /** The `script_name` declared at the top level of a block, if any. */
  scriptName(label: string): string | undefined {
    const found = this.blocks.get(label)?.stmts.find((s) =>
      s.node.type === "script_name_statement"
    );
    return found
      ? unquote(found.node.namedChildren.find((c) => c.type === "string")!.text)
      : undefined;
  }
}

type Pending = {
  node: GraphNode;
  program?: SourceProgram;
  source?: string;
  entry: string;
};

/** Builds a {@link GraphData} for the program that starts at `entry`. */
export class ThreadGraph {
  readonly #entry: string;
  readonly #wasm: string;
  readonly #options: GraphOptions;
  readonly #tracked: Set<string>;
  readonly #nodes = new Map<string, GraphNode>();
  readonly #programOf = new Map<string, SourceProgram>();
  readonly #unresolved: Unresolved[] = [];
  readonly #queue: Pending[] = [];

  constructor(entry: string, wasm: string, options: GraphOptions) {
    this.#entry = entry;
    this.#wasm = wasm;
    this.#options = options;
    this.#tracked = new Set(options.trackedVars);
  }

  async build(): Promise<GraphData> {
    const main = await SourceProgram.load(this.#entry, this.#wasm);
    const root = this.#register({
      id: "MAIN",
      level: 0,
      kind: "main",
      name: main.scriptName(START) ?? "MAIN",
      entry: { label: START, ...main.blocks.get(START)!.at },
      parents: [],
      labels: [],
      edges: [],
      flags: [],
    }, main);
    this.#queue.push({ node: root, program: main, entry: START });
    while (this.#queue.length) {
      const item = this.#queue.shift()!;
      const program = item.program ??
        await SourceProgram.load(item.source!, this.#wasm, main.root);
      this.#programOf.set(item.node.id, program);
      this.#analyze(item.node, program, item.entry);
    }
    return this.#data(main);
  }

  #register(node: GraphNode, program: SourceProgram): GraphNode {
    this.#nodes.set(node.id, node);
    this.#programOf.set(node.id, program);
    return node;
  }

  #analyze(node: GraphNode, program: SourceProgram, entry: string) {
    node.labels = program.reach(entry, (kind, target, at) => {
      this.#unresolved.push({ from: node.id, kind, target, at });
    });
    for (const label of node.labels) {
      for (const { node: stmt, file } of program.blocks.get(label)!.stmts) {
        for (const n of walk(stmt)) {
          const at = { file, line: n.startPosition.row + 1 };
          this.#collectEdge(node, n, label, at, program, entry);
          const flag = this.#tracked.has(n.text) ? classifyFlag(n) : null;
          if (flag) node.flags.push({ ...flag, label, at });
        }
      }
    }
    if (
      this.#options.outline.some((label) => program.resolve(label) === entry)
    ) {
      node.outline = node.labels.map((label) => {
        const block = program.blocks.get(label)!;
        return {
          label,
          at: block.at,
          statements: block.stmts.map((s) => outlineOf(s.node)),
        };
      });
    }
  }

  #collectEdge(
    owner: GraphNode,
    n: Node,
    label: string,
    at: Position,
    program: SourceProgram,
    entry: string,
  ) {
    const edge = (e: Omit<Edge, "label" | "at">) =>
      owner.edges.push({ ...e, label, at });
    switch (n.type) {
      case "start_new_script_statement": {
        const written = labelOf(n);
        const target = program.resolve(written);
        if (target === undefined) {
          this.#unresolved.push({
            from: owner.id,
            kind: "start_new_script",
            target: written,
            at,
          });
          edge({ kind: "start_new_script", target: written });
          return;
        }
        edge({
          kind: "start_new_script",
          target,
          ...(target === entry ? { self: true as const } : {}),
        });
        this.#discover(owner, target, "thread", program);
        return;
      }
      case "function_call": {
        if (n.firstNamedChild?.text !== "Mission.LoadAndLaunchInternal") return;
        const number = Number(
          n.namedChildren.find((c) => c.type === "argument_list")
            ?.firstNamedChild?.text,
        );
        edge({ kind: "launch_mission", target: String(number) });
        const mission = program.missions.get(number);
        const label = mission && program.resolve(mission.label);
        if (!mission) {
          this.#unresolved.push({
            from: owner.id,
            kind: "launch_mission",
            target: String(number),
            at,
          });
        } else if (label === undefined) {
          this.#unresolved.push({
            from: owner.id,
            kind: "mission_label",
            target: mission.label,
            at: mission.at,
          });
        } else this.#discover(owner, label, "mission", program, number);
        return;
      }
      case "legacy_command": {
        const opcode = n.namedChildren.find((c) => c.type === "opcode")?.text
          .toUpperCase();
        if (opcode === "0600") {
          const script = unquote(
            n.namedChildren.find((c) => c.type === "string")?.text ?? "",
          );
          edge({ kind: "stream_custom_script", target: script });
          this.#discoverCleo(owner, script, program);
        } else if (opcode === "05DC") edge({ kind: "terminate_custom_thread" });
        return;
      }
      case "terminate_named_scripts":
        edge({
          kind: "terminate_by_name",
          target: unquote(
            n.namedChildren.find((c) => c.type === "string")!.text,
          ),
        });
        return;
      case "terminate_script":
        edge({ kind: "terminate_this_script" });
        return;
    }
  }

  #discover(
    parent: GraphNode,
    label: string,
    kind: "thread" | "mission",
    program: SourceProgram,
    mission?: number,
  ) {
    const existing = this.#nodes.get(label);
    if (existing) {
      if (!existing.parents.includes(parent.id)) {
        existing.parents.push(parent.id);
      }
      if (mission !== undefined && existing.mission === undefined) {
        existing.mission = mission;
        existing.kind = "mission";
      }
      return;
    }
    const created = this.#register({
      id: label,
      level: parent.level + 1,
      kind,
      name: program.scriptName(label) ?? label,
      entry: { label, ...program.blocks.get(label)!.at },
      ...(mission !== undefined ? { mission } : {}),
      parents: [parent.id],
      labels: [],
      edges: [],
      flags: [],
    }, program);
    this.#queue.push({ node: created, program, entry: label });
  }

  #discoverCleo(parent: GraphNode, script: string, program: SourceProgram) {
    const id = `cleo:${script}`;
    const existing = this.#nodes.get(id);
    if (existing) {
      if (!existing.parents.includes(parent.id)) {
        existing.parents.push(parent.id);
      }
      return;
    }
    const stem = basename(script).replace(/\.[^.]+$/, "");
    const source = this.#options.cleoDirs.map((d) =>
      join(program.root, d, `${stem}.txt`)
    ).find((p) => existsSync(p));
    if (!source) {
      this.#unresolved.push({
        from: parent.id,
        kind: "stream_custom_script",
        target: script,
        at: parent.entry,
      });
      return;
    }
    const created = this.#register({
      id,
      level: parent.level + 1,
      kind: "cleo",
      name: stem,
      entry: { label: START, file: program.display(source), line: 1 },
      parents: [parent.id],
      labels: [],
      edges: [],
      flags: [],
    }, program);
    this.#queue.push({ node: created, source, entry: START });
  }

  #data(main: SourceProgram): GraphData {
    const programs = [...new Set(this.#programOf.values())];
    const nodes = [...this.#nodes.values()];
    const flagUses: GraphData["flagUses"] = [];
    const scriptNames: ScriptName[] = [];
    for (const program of programs) {
      for (const { file, tree } of program.trees) {
        for (const n of walk(tree.rootNode)) {
          const flag = this.#tracked.has(n.text) ? classifyFlag(n) : null;
          if (flag) {
            flagUses.push({ ...flag, file, line: n.startPosition.row + 1 });
          }
        }
      }
      for (const block of program.blocks.values()) {
        const name = program.scriptName(block.label);
        if (name === undefined) continue;
        const status = nodes.some((n) =>
            this.#programOf.get(n.id) === program &&
            n.entry.label === block.label
          )
          ? "entry"
          : nodes.some((n) =>
              this.#programOf.get(n.id) === program &&
              n.labels.includes(block.label)
            )
          ? "reached"
          : "unreached";
        scriptNames.push({ name, label: block.label, at: block.at, status });
      }
    }
    // Programs repeat when several nodes share one, so a use found twice is kept once.
    const uniqueUses = flagUses.filter((u, i) =>
      flagUses.findIndex((v) =>
        v.file === u.file && v.line === u.line && v.var === u.var &&
        v.access === u.access
      ) === i
    );
    return {
      entry: main.display(this.#entry),
      trackedVars: this.#options.trackedVars,
      parseErrors: programs.flatMap((p) => p.parseErrors),
      missingIncludes: programs.flatMap((p) => p.missingIncludes),
      missions: [...main.missions].sort(([a], [b]) => a - b).map((
        [number, m],
      ) => ({
        number,
        label: m.label,
        at: m.at,
        resolved: main.resolve(m.label) !== undefined,
      })),
      nodes,
      scriptNames,
      unresolved: this.#unresolved,
      flagUses: uniqueUses,
    };
  }
}
