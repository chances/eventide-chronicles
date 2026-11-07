/**
 * @module
 * Local chart server. Serves `dist/charts/<mission>.html` and writes author marks into
 * `missions/<mission>.chart.json`. Accepts only the missions in `MISSIONS`, writes each JSON file through a
 * temporary file and a rename, and binds to 127.0.0.1.
 *
 * @remarks
 * A request whose path is not one of the six `MISSIONS` names is rejected and nothing is written. The only
 * files the server writes are `missions/*.chart.json` and `./Phrasebook.csv`.
 *
 * Usage: `deno task chart:serve [--port <number>]` (default port 8080). Run from the repository root.
 */
import { parseArgs } from "@std/cli/parse-args";
import { parse, stringify } from "@std/csv";
import { dirname, isAbsolute, join } from "@std/path";
import { ChartAssembler } from "./assembler.ts";
import {
  loadCommandDescriptions,
  type PhraseRow,
  suggestPhrase,
} from "./guards.ts";
import { collapse, type Statement } from "./marks.ts";
import { PageRenderer } from "./render.ts";
import {
  type ChartFile,
  ChartSchema,
  SchemaError,
  UnknownVersionError,
} from "./schema.ts";

export type Key = { statementText: string; occurrence?: number };

export type MarkAction =
  | {
    action: "add";
    statementText: string;
    occurrence?: number;
    label?: string;
  }
  | { action: "remove"; statementText: string; occurrence?: number }
  | { action: "set"; from: Key; to: Key };

export interface ChartServerOptions {
  library?: string;
  phrasebook?: string;
  entry?: string;
  wasm?: string;
  cleoDirs?: string[];
  assembler?: { statements(mission: string): Promise<Statement[]> };
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const keyOf = (key: Key): string =>
  `${collapse(key.statementText)}\0${key.occurrence ?? 1}`;

const indexOf = (chart: ChartFile, key: Key, verb: string): number => {
  const i = chart.marks.findIndex((m) => keyOf(m) === keyOf(key));
  if (i < 0) {
    throw new HttpError(
      404,
      `Could not ${verb} on ${
        JSON.stringify(key.statementText)
      } in ${chart.mission}. No mark sits on that statement. Reload the page to see the current marks.`,
    );
  }
  return i;
};

/** Returns the chart with one mark added, relabeled, moved, or removed. Throws HttpError on a missing or duplicate mark. */
export function applyMarkAction(
  chart: ChartFile,
  action: MarkAction,
): ChartFile {
  const marks = [...chart.marks];
  if (action.action === "add") {
    const key: Key = {
      statementText: action.statementText,
      occurrence: action.occurrence,
    };
    const existing = marks.findIndex((m) => keyOf(m) === keyOf(key));
    const label = action.label || undefined;
    if (existing >= 0) {
      marks[existing] = { ...marks[existing], label };
    } else {
      marks.push({
        statementText: action.statementText,
        ...(action.occurrence !== undefined
          ? { occurrence: action.occurrence }
          : {}),
        ...(label !== undefined ? { label } : {}),
      });
    }
  } else if (action.action === "remove") {
    marks.splice(indexOf(chart, action, "remove the mark"), 1);
  } else {
    const i = indexOf(chart, action.from, "move the mark");
    if (marks.some((m, j) => j !== i && keyOf(m) === keyOf(action.to))) {
      throw new HttpError(
        409,
        `Could not move the mark on ${
          JSON.stringify(action.from.statementText)
        } to ${
          JSON.stringify(action.to.statementText)
        } in ${chart.mission}. Another mark already sits on ${
          JSON.stringify(action.to.statementText)
        }. Remove that mark first, then move this one.`,
      );
    }
    const { label } = marks[i];
    marks[i] = {
      statementText: action.to.statementText,
      ...(action.to.occurrence !== undefined
        ? { occurrence: action.to.occurrence }
        : {}),
      ...(label !== undefined ? { label } : {}),
    };
  }
  return { ...chart, marks };
}

const MARK_ROUTE = /^\/([a-z]+)\/marks$/;
const PAGE_ROUTE = /^\/([a-z]+)(\.html)?$/;
const REBUILD_ROUTE = /^\/([a-z]+)\/regenerate$/;
const STATIC_ROUTE = /^\/static\/([a-zA-Z0-9_.-]+)$/;

export class ChartServer {
  #root: string;
  #schema = new ChartSchema();
  #phrasebookPath: string;
  #libraryPath?: string;
  #descriptions?: Map<string, string>;
  #entryPath: string;
  #wasmPath?: string;
  #cleoDirs: string[];
  #assembler?: { statements(mission: string): Promise<Statement[]> };

  /** `root` is the repository root holding `missions/` and `dist/charts/`. */
  constructor(
    root: string,
    options?: ChartServerOptions,
  ) {
    this.#root = root;
    this.#phrasebookPath = options?.phrasebook ?? join(root, "Phrasebook.csv");
    this.#libraryPath = options?.library;
    if (!this.#libraryPath) {
      const sanny = Deno.env.get("SANNY");
      if (sanny) {
        this.#libraryPath = join(dirname(sanny), "data", "vc_sbl", "vc.json");
      }
    }
    this.#entryPath = options?.entry ?? join(root, "main.txt");
    this.#wasmPath = options?.wasm ?? Deno.env.get("SBL_WASM");
    if (!this.#wasmPath) {
      try {
        const envContent = Deno.readTextFileSync(join(root, ".env"));
        for (const line of envContent.split(/\r?\n/)) {
          const match = /^\s*SBL_WASM\s*=\s*(.*)$/.exec(line);
          if (match) {
            let val = match[1].trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            this.#wasmPath = val;
            break;
          }
        }
      } catch {
        // Fall back to env
      }
    }
    this.#cleoDirs = options?.cleoDirs ?? ["lib/threads"];
    if (options?.assembler) {
      this.#assembler = options.assembler;
    }
  }

  #getAssembler(): { statements(mission: string): Promise<Statement[]> } {
    if (!this.#assembler) {
      if (!this.#wasmPath) {
        throw new HttpError(
          500,
          "SBL_WASM is not set; point it at tree-sitter-gta3.wasm in .env or pass wasm to ChartServer.",
        );
      }
      this.#assembler = new ChartAssembler(
        this.#entryPath,
        this.#wasmPath,
        {
          cleoDirs: this.#cleoDirs,
          phrasebook: this.#phrasebookPath,
          library: this.#libraryPath,
        },
      );
    }
    return this.#assembler;
  }

  #getDescriptions(): Map<string, string> {
    if (!this.#descriptions) {
      if (this.#libraryPath) {
        try {
          this.#descriptions = loadCommandDescriptions(this.#libraryPath);
        } catch {
          this.#descriptions = new Map();
        }
      } else {
        this.#descriptions = new Map();
      }
    }
    return this.#descriptions;
  }

  /** Indexes missions programmatically from the missions directory. */
  async listMissions(): Promise<string[]> {
    const missionsDir = join(this.#root, "missions");
    const found: string[] = [];
    try {
      for await (const entry of Deno.readDir(missionsDir)) {
        if (entry.isFile && entry.name.endsWith(".chart.json")) {
          found.push(entry.name.replace(/\.chart\.json$/, ""));
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    return found.sort();
  }

  async handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (
        request.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/index.html")
      ) {
        if (request.headers.get("accept")?.includes("text/html")) {
          return await this.#indexPage();
        }
      }

      const staticMatch = STATIC_ROUTE.exec(url.pathname);
      if (request.method === "GET" && staticMatch) {
        return await this.#static(staticMatch[1]);
      }

      if (request.method === "GET" && url.pathname === "/source") {
        const file = url.searchParams.get("file");
        if (!file) throw new HttpError(400, "Missing file parameter.");
        return await this.#serveSource(file);
      }

      if (request.method === "GET" && url.pathname === "/phrases/suggest") {
        const expression = url.searchParams.get("expression");
        if (!expression) {
          throw new HttpError(400, "Missing expression parameter.");
        }
        const suggested = await suggestPhrase(
          expression,
          this.#getDescriptions(),
        );
        return text(200, JSON.stringify(suggested), "application/json");
      }

      if (request.method === "POST" && url.pathname === "/phrases") {
        return await this.#savePhrase(request);
      }

      const page = PAGE_ROUTE.exec(url.pathname);
      if (request.method === "GET" && page) {
        return await this.#page(page[1]);
      }
      const marks = MARK_ROUTE.exec(url.pathname);
      if (request.method === "POST" && marks) {
        return await this.#writeMarks(marks[1], request);
      }
      const rebuild = REBUILD_ROUTE.exec(url.pathname);
      if (request.method === "POST" && rebuild) {
        return await this.#rebuild(rebuild[1]);
      }

      return text(
        404,
        `Could not ${request.method} ${url.pathname}. Available routes: GET /<mission>.html, POST /<mission>/marks, POST /<mission>/regenerate.`,
      );
    } catch (error) {
      if (error instanceof HttpError) return text(error.status, error.message);
      throw error;
    }
  }

  async #indexPage(): Promise<Response> {
    const missions = await this.listMissions();
    const cards = await Promise.all(
      missions.map(async (m) => {
        const title = m.charAt(0).toUpperCase() + m.slice(1);
        let errorCount = 0;
        let warningCount = 0;
        let globalsCount = 0;
        try {
          const file = join(this.#root, "missions", `${m}.chart.json`);
          const chart = await this.#readChart(m, file);
          errorCount = chart.errors?.filter((e) =>
            e.severity === "error"
          ).length ?? 0;
          warningCount = (chart.errors?.filter((e) =>
            e.severity === "warning"
          ).length ??
            0) + (chart.conflicts?.length ?? 0);
          globalsCount = chart.globals?.length ?? 0;
        } catch {
          // Fallback if chart file cannot be read
        }

        const chips = [];
        if (errorCount > 0) {
          chips.push(
            `<span class="problem-chip error">${errorCount} ${
              errorCount === 1 ? "Error" : "Errors"
            }</span>`,
          );
        }
        if (warningCount > 0) {
          chips.push(
            `<span class="problem-chip warning">${warningCount} ${
              warningCount === 1 ? "Warning" : "Warnings"
            }</span>`,
          );
        }
        if (errorCount === 0 && warningCount === 0) {
          chips.push(
            `<span class="badge" style="color: var(--pass); border-color: rgba(0, 217, 163, 0.4);">0 Problems</span>`,
          );
        }
        if (globalsCount > 0) {
          chips.push(
            `<span class="badge">${globalsCount} globals</span>`,
          );
        }

        return `
        <a href="/${m}.html" class="mission-card">
          <div class="mission-card-top">
            <h3 class="mission-card-title">${title}</h3>
            <code class="mission-card-file">${m}.txt</code>
          </div>
          <div class="mission-card-chips">
            ${chips.join("\n")}
          </div>
        </a>`;
      }),
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Charts</title>
  <link rel="stylesheet" href="/static/chart.css">
</head>
<body>
  <main>
    <header class="ide-header">
      <div class="ide-header-left">
        <h1 class="ide-title">Mission Charts</h1>
      </div>
      <div class="ide-header-right">
        <span class="badge">${missions.length} ${
      missions.length === 1 ? "Mission" : "Missions"
    }</span>
      </div>
    </header>
    <div class="index-content">
      <div class="index-container">
        <div class="index-heading-row">
          <h2 class="index-heading">Available Missions</h2>
          <p class="index-subtitle">Select a mission to inspect its statements, diagnostics, globals, launch sites, and effect traces.</p>
        </div>
        <div class="mission-grid">
          ${cards.join("\n")}
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  async #static(filename: string): Promise<Response> {
    if (
      filename.includes("..") || filename.includes("/") ||
      filename.includes("\\")
    ) {
      return text(400, "Invalid static file path.");
    }
    const path = join(this.#root, "tools", "chart", "static", filename);
    try {
      const content = await Deno.readTextFile(path);
      const contentType = filename.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filename.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : "text/plain; charset=utf-8";
      return new Response(content, {
        headers: { "content-type": contentType },
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return text(404, `Static asset ${filename} not found.`);
      }
      throw error;
    }
  }

  async #serveSource(file: string): Promise<Response> {
    if (
      file.includes("..") || file.startsWith("/") || file.startsWith("\\")
    ) {
      throw new HttpError(400, "Invalid file path.");
    }
    const path = join(this.#root, file);
    try {
      const content = await Deno.readTextFile(path);
      return new Response(content, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new HttpError(404, `Source file ${file} not found.`);
      }
      throw error;
    }
  }

  async #mission(name: string, action: string): Promise<string> {
    const missions = await this.listMissions();
    if (!missions.includes(name)) {
      const available = missions.length > 0
        ? missions.join(", ")
        : "no charted missions found in missions/";
      throw new HttpError(
        404,
        `Could not ${action} for ${
          JSON.stringify(name)
        }. The chart server reads ${available}. Use one of those names.`,
      );
    }
    return name;
  }

  async #readChart(
    mission: string,
    file: string,
    action = "save marks",
  ): Promise<ChartFile> {
    try {
      return this.#schema.check(JSON.parse(await Deno.readTextFile(file)));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new HttpError(
          404,
          `Could not ${action} for ${mission}. missions/${mission}.chart.json does not exist. Run deno task chart ${mission} to create it.`,
        );
      }
      if (
        error instanceof SchemaError || error instanceof UnknownVersionError ||
        error instanceof SyntaxError
      ) {
        throw new HttpError(
          500,
          `Could not ${action} for ${mission}. missions/${mission}.chart.json is not a valid chart: ${error.message}. Fix the file, or run deno task chart ${mission} to rebuild it, then reload.`,
        );
      }
      throw error;
    }
  }

  async #page(name: string): Promise<Response> {
    const mission = await this.#mission(name, "open the chart");
    const file = join(this.#root, "missions", `${mission}.chart.json`);
    const chart = await this.#readChart(mission, file, "open the chart");
    const assembler = this.#getAssembler();
    const statements = await assembler.statements(mission);
    const renderer = new PageRenderer(
      chart,
      statements,
      (filePath) => {
        const full = isAbsolute(filePath)
          ? filePath
          : join(this.#root, filePath);
        return Deno.readTextFileSync(full);
      },
    );
    return new Response(renderer.render(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  /** Runs the chart command for one mission, which rewrites its JSON and page, and returns the orphaned marks. */
  async #rebuild(name: string): Promise<Response> {
    const mission = await this.#mission(name, "rebuild the chart");
    const { code, stderr } = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--env-file=.env",
        "--allow-env",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "tools/chart/main.ts",
        mission,
      ],
      cwd: this.#root,
      stdout: "null",
      stderr: "piped",
    }).output();
    if (code !== 0) {
      const detail =
        new TextDecoder().decode(stderr).trim().split("\n").at(-1) ??
          "no message";
      throw new HttpError(
        500,
        `Could not rebuild the chart for ${mission}. The chart command stopped with exit code ${code}: ${detail}. Fix the source, then rebuild again.`,
      );
    }
    const chart = await this.#readChart(
      mission,
      join(this.#root, "missions", `${mission}.chart.json`),
      "rebuild the chart",
    );
    const orphans = chart.marks
      .filter((m) => m.orphaned)
      .map((m) => ({
        statementText: m.statementText,
        occurrence: m.occurrence ?? 1,
        label: m.label,
      }));
    return text(200, JSON.stringify({ ok: true, orphans }), "application/json");
  }

  async #writeMarks(name: string, request: Request): Promise<Response> {
    const mission = await this.#mission(name, "save marks");
    const file = join(this.#root, "missions", `${mission}.chart.json`);
    const action = await readAction(request, mission);
    const chart = await this.#readChart(mission, file, "save marks");
    const next = this.#schema.check(applyMarkAction(chart, action));
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    await Deno.writeTextFile(temp, JSON.stringify(next, null, 2) + "\n");
    await Deno.rename(temp, file);
    return text(
      200,
      JSON.stringify({ ok: true, marks: next.marks }),
      "application/json",
    );
  }

  async #savePhrase(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "The request body is not JSON.");
    }
    const b = body as Record<string, unknown>;
    const expression = typeof b?.expression === "string"
      ? b.expression.trim()
      : "";
    const rawPhrase = typeof b?.phrase === "string" ? b.phrase.trim() : "";
    const nominal = typeof b?.nominal === "string"
      ? b.nominal.trim()
      : rawPhrase;
    const opposite = typeof b?.opposite === "string"
      ? b.opposite.trim()
      : (typeof b?.suggestedOpposite === "string"
        ? (b.suggestedOpposite as string).trim()
        : (nominal ? `not ${nominal}` : ""));
    const active = typeof b?.active === "string" ? b.active.trim() : "";

    if (!expression || !nominal || !opposite) {
      throw new HttpError(
        400,
        "A phrase requires expression, nominal, and opposite string fields.",
      );
    }

    const file = this.#phrasebookPath;
    let rows: PhraseRow[] = [];
    try {
      const content = await Deno.readTextFile(file);
      rows = parse(content, { skipFirstRow: true }) as PhraseRow[];
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }

    const existingIndex = rows.findIndex((r) => r.expression === expression);
    const updated: PhraseRow = { expression, nominal, opposite, active };
    if (existingIndex >= 0) {
      rows[existingIndex] = updated;
    } else {
      rows.push(updated);
    }

    const csv = stringify(rows, {
      columns: ["expression", "nominal", "opposite", "active"],
    });
    await Deno.writeTextFile(file, csv);
    return text(
      200,
      JSON.stringify({ ok: true, phrase: updated }),
      "application/json",
    );
  }
}

async function readAction(
  request: Request,
  mission: string,
): Promise<MarkAction> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(
      400,
      `Could not save marks for ${mission}. The request body is not JSON. Send the change as JSON, for example {"action": "add", "statementText": "Wait 0 ms"}.`,
    );
  }
  const action = (body as { action?: unknown })?.action;
  if (action !== "add" && action !== "remove" && action !== "set") {
    throw new HttpError(
      400,
      `Could not save marks for ${mission}. The action ${
        JSON.stringify(action)
      } is unknown. Use add, remove, or set.`,
    );
  }
  return body as MarkAction;
}

function text(
  status: number,
  body: string,
  type = "text/plain; charset=utf-8",
): Response {
  return new Response(body, { status, headers: { "content-type": type } });
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, { string: ["port"] });
  const port = Number(args.port ?? 8080);
  const server = new ChartServer(Deno.cwd());
  Deno.serve(
    { hostname: "127.0.0.1", port },
    (request) => server.handle(request),
  );
  console.log(`chart server on http://127.0.0.1:${port}`);
}
