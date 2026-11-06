/**
 * @module
 * Renders one mission's chart JSON and its statements as a single self-contained dark HTML page.
 * The page holds the globals, launch sites, conflicts, errors, orphaned marks, states, statements, and
 * traces, with a mark control on each statement. Orphans are marks whose statement no longer exists;
 * each one gets the nearest statement by Levenshtein distance as its Accept Suggestion target.
 */
import { distance } from "@alg/levenshtein";
import { render as ssrRender } from "@lit-labs/ssr";
import { html, nothing, svg } from "lit-html";
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  type IconNode,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide";
import { collapse, MarksMerger, type Statement } from "./marks.ts";
import type { ChartFile } from "./schema.ts";

/** How long the undo message stays after an orphaned mark is discarded. */
export const UNDO_MS = 8000;

function renderToString(template: unknown): string {
  let output = "";
  for (const chunk of ssrRender(template)) {
    output += chunk;
  }
  return output;
}

function renderIcon(icon: IconNode, size = 16, className = "lucide-icon") {
  return svg`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class=${className}
      aria-hidden="true"
    >
      ${icon.map(([tag, attrs]) => {
        if (tag === "path") {
          return svg`<path d=${attrs.d} />`;
        }
        if (tag === "line") {
          return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
        }
        if (tag === "circle") {
          return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
        }
        if (tag === "polyline") {
          return svg`<polyline points=${attrs.points} />`;
        }
        return svg``;
      })}
    </svg>
  `;
}

const titleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

const isStartupScript = (script: string): boolean => {
  const s = script.toUpperCase();
  return s === "MAIN" || s === "INIT";
};

const LOCK_TRIGGER_SCRIPTS = new Set([
  "star",
  "police",
  "hot",
  "boss",
  "golf",
  "kill",
  "end",
]);

const isLockedScript = (script: string): boolean =>
  LOCK_TRIGGER_SCRIPTS.has(script.toLowerCase());

export class PageRenderer {
  #chart: ChartFile;
  #statements: Statement[];
  /** The statement each mark sits on, in mark order; null marks an orphan. */
  #anchors: (Statement | null)[];
  #fileReader?: (file: string) => string;

  constructor(
    chart: ChartFile,
    statements: Statement[],
    fileReader?: (file: string) => string,
  ) {
    this.#chart = chart;
    this.#statements = statements;
    this.#anchors = MarksMerger.anchors(chart.marks, statements);
    this.#fileReader = fileReader;
  }

  #readSourceLines(filePath: string): string[] | undefined {
    if (this.#fileReader) {
      try {
        return this.#fileReader(filePath).split(/\r?\n/);
      } catch {
        // Fall back to Deno.readTextFileSync
      }
    }
    if (
      typeof Deno !== "undefined" && typeof Deno.readTextFileSync === "function"
    ) {
      try {
        return Deno.readTextFileSync(filePath).split(/\r?\n/);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /** The statement with the fewest single-letter edits from `text`; the earlier one wins a tie. */
  nearest(text: string): Statement | undefined {
    let best: Statement | undefined;
    let bestDistance = Infinity;
    for (const statement of this.#statements) {
      const d = distance(collapse(text), collapse(statement.text));
      if (d < bestDistance) {
        best = statement;
        bestDistance = d;
      }
    }
    return best;
  }

  render(): string {
    const name = titleCase(this.#chart.mission);
    const title = `${name} Chart`;
    const errors = this.#chart.errors ?? [];
    const errorCount = errors.filter((e) => e.severity === "error").length;
    const groupedConflicts = this.#groupedConflicts();
    const activeConflicts = groupedConflicts.filter((g) => !g.isFiltered);
    const warningCount = errors.filter((e) => e.severity === "warning").length +
      activeConflicts.length;

    const mainContent = renderToString(html`
      <header class="ide-header">
        <div class="ide-header-left">
          <nav class="breadcrumbs" aria-label="Breadcrumbs">
            <a href="/" class="breadcrumb-link"
              title="Mission Charts Index">Missions</a>
            <span class="breadcrumb-separator" aria-hidden="true">/</span>
            <h1 class="ide-title">${name}</h1>
          </nav>
          <div class="problem-chips">
            <button
              type="button"
              class="problem-chip error"
              title="Jump to problem"
            >
              ${renderIcon(AlertCircle)}
              <span>${errorCount} ${errorCount === 1
                ? "Error"
                : "Errors"}</span>
            </button>
            <button
              type="button"
              class="problem-chip warning"
              title="Jump to problem"
            >
              ${renderIcon(AlertTriangle)}
              <span>${warningCount} ${warningCount === 1
                ? "Warning"
                : "Warnings"}</span>
            </button>
          </div>
        </div>
        <div class="ide-header-right">
          <button
            type="button"
            class="primary-button"
            id="rebuild"
            title="Rebuild Chart"
            aria-label=${`Rebuild the chart for ${this.#chart.mission} from the source, keeping its marks`}
          >
            ${renderIcon(RefreshCw)}
            <span>Rebuild</span>
          </button>
        </div>
      </header>
      <p class="status" id="status" role="status" aria-live="polite"
        style="display:none;"></p>
      ${this.#orphans()}
      <div class="ide-workspace">
        <div class="editor-pane">
          <div class="editor-tabs">
            <button
              type="button"
              class="editor-tab active"
              data-editor-tab="script"
            >Mission Script</button>
            <button
              type="button"
              class="editor-tab"
              data-editor-tab="launch"
            >Launch Site</button>
          </div>
          <div class="editor-view-container">
            <div class="code-view active" data-editor-view="script">
              ${this.#statementList()}
            </div>
            <div class="code-view" data-editor-view="launch">
              ${this.#launchSites()}
            </div>
          </div>
          ${this.#problems()}
        </div>
        <aside class="inspector-sidebar">
          <div class="inspector-tabs">
            <button
              type="button"
              class="inspector-tab active"
              data-inspector-tab="globals"
            >Globals (<span id="visible-globals-count">${this.#groupedGlobals()
              .filter((g) => !g.isFiltered).length}</span>)</button>
            <button
              type="button"
              class="inspector-tab"
              data-inspector-tab="states"
            >States (${this.#chart.states.length})</button>
            <button
              type="button"
              class="inspector-tab"
              data-inspector-tab="traces"
            >Traces (${this.#chart.traces.length})</button>
          </div>
          <div class="inspector-content">
            <div class="inspector-pane active" data-inspector-pane="globals">
              ${this.#globals()}
            </div>
            <div class="inspector-pane" data-inspector-pane="states">
              ${this.#states()}
            </div>
            <div class="inspector-pane" data-inspector-pane="traces">
              ${this.#traces()}
            </div>
          </div>
        </aside>
      </div>
    `);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="/static/chart.css">
  </head>
  <body data-mission="${this.#chart.mission}" data-mission-file="${this.#missionFile()}">
    <main>
      ${mainContent}
    </main>
    <div class="toast" role="status" data-undo-ms="${UNDO_MS}" hidden></div>
    <script type="module" src="/static/chart.js"></script>
  </body>
</html>`;
  }

  #groupedGlobals(): {
    name: string;
    accessors: {
      accessor: string;
      kinds: string[];
    }[];
    totalAccesses: number;
    firstMissionLine?: number;
  }[] {
    const map = new Map<string, Map<string, Set<string>>>();
    for (const g of this.#chart.globals) {
      let accMap = map.get(g.name);
      if (!accMap) {
        accMap = new Map();
        map.set(g.name, accMap);
      }
      let kinds = accMap.get(g.accessor);
      if (!kinds) {
        kinds = new Set();
        accMap.set(g.accessor, kinds);
      }
      kinds.add(g.kind);
    }

    const missionName = this.#chart.mission.toLowerCase();
    const missionFile = this.#missionFile();
    const missionLinesByGlobal = new Map<string, number>();
    for (const c of this.#chart.conflicts) {
      for (const a of c.accesses) {
        if (a.script.toLowerCase() === missionName || a.file === missionFile) {
          const prev = missionLinesByGlobal.get(c.global);
          if (prev === undefined || a.line < prev) {
            missionLinesByGlobal.set(c.global, a.line);
          }
        }
      }
    }

    const result = [];
    for (const [name, accMap] of map.entries()) {
      const accessors = [];
      let total = 0;
      for (const [accessor, kinds] of accMap.entries()) {
        const kindArr = [...kinds].sort();
        total += kindArr.length;
        const filterKind: "active" | "startup" | "locked" =
          isStartupScript(accessor)
            ? "startup"
            : isLockedScript(accessor)
            ? "locked"
            : "active";
        accessors.push({ accessor, kinds: kindArr, filterKind });
      }
      accessors.sort((a, b) => {
        const aIsMission = a.accessor.toLowerCase() === missionName;
        const bIsMission = b.accessor.toLowerCase() === missionName;
        if (aIsMission !== bIsMission) return aIsMission ? -1 : 1;
        return a.accessor.localeCompare(b.accessor);
      });

      const otherAccessors = accessors.filter(
        (a) => a.accessor.toLowerCase() !== missionName,
      );
      const hasActive = otherAccessors.some((a) => a.filterKind === "active");
      const hasStartup = otherAccessors.some((a) => a.filterKind === "startup");
      const hasLocked = otherAccessors.some((a) => a.filterKind === "locked");
      const filterKind = [
        hasStartup ? "startup" : "",
        hasLocked ? "locked" : "",
      ].filter(Boolean).join(" ");
      const isFiltered = otherAccessors.length > 0 && !hasActive;

      result.push({
        name,
        accessors,
        filterKind,
        isFiltered,
        totalAccesses: total,
        firstMissionLine: missionLinesByGlobal.get(name),
      });
    }

    return result.sort((a, b) => {
      if (a.isFiltered !== b.isFiltered) {
        return a.isFiltered ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  #globals() {
    const grouped = this.#groupedGlobals();
    if (grouped.length === 0) {
      return html`<p class="muted">No globals accessed.</p>`;
    }

    const startupCount = grouped.filter(
      (g) => g.isFiltered && g.filterKind.includes("startup"),
    ).length;
    const lockedCount = grouped.filter(
      (g) => g.isFiltered && g.filterKind.includes("locked"),
    ).length;

    return html`
      <div class="inspector-search-bar">
        <input
          type="search"
          class="pane-find-box"
          id="globals-find"
          placeholder="Filter globals…"
          aria-label="Filter globals"
        >
        <div class="filter-actions">
          ${startupCount > 0
            ? html`
              <button
                type="button"
                class="filter-chip"
                id="toggle-globals-startup"
                data-filter="startup"
                aria-pressed="false"
                title="Show globals accessed only by startup scripts"
              >
                Startup (${startupCount})
              </button>
            `
            : nothing}
          ${lockedCount > 0
            ? html`
              <button
                type="button"
                class="filter-chip"
                id="toggle-globals-locked"
                data-filter="locked"
                aria-pressed="false"
                title="Show globals accessed only by lock-respecting threads"
              >
                Locked (${lockedCount})
              </button>
            `
            : nothing}
        </div>
      </div>
      <p class="inspector-hint">
        Shows all variables accessed by this mission, including non-conflicting reads.
      </p>
      <div class="tree-list globals-tree-list">
        ${grouped.map((g) => {
          const jumpAttrs = g.firstMissionLine !== undefined
            ? html`data-jump-line=${g.firstMissionLine} data-jump-file=${this.#missionFile()}`
            : nothing;
          return html`
            <details
              class="tree-node global-tree-node ${g.isFiltered
                ? "is-filtered"
                : ""}"
              data-global-name=${g.name.toLowerCase()}
              data-filter-kind=${g.filterKind}
            >
              <summary class="tree-summary" ${jumpAttrs}>
                <strong class="tree-title"><code>${g.name}</code></strong>
                <span class="tree-count">${g.accessors
                  .length} ${g.accessors.length === 1
                  ? "accessor"
                  : "accessors"}</span>
              </summary>
              <ul class="tree-children">
                ${g.accessors.map((acc) =>
                  html`
                    <li
                      class="tree-child-row"
                      data-global=${g.name}
                      data-accessor=${acc.accessor}
                      data-filter-kind=${acc.filterKind}
                    >
                      <span class="tree-label">${acc.accessor}</span>
                      <span class="tree-badges">
                        ${acc.kinds.map((k) =>
                          html`<span class="badge ${k}">${k}</span>`
                        )}
                      </span>
                    </li>
                  `
                )}
              </ul>
            </details>
          `;
        })}
      </div>
    `;
  }

  #launchSites() {
    if (this.#chart.launchSites.length === 0) {
      return html`
        <p class="muted"
          style="padding: 16px;">No launch sites found for this mission.</p>
      `;
    }
    return this.#chart.launchSites.map((site) => {
      const lines = this.#readSourceLines(site.file);
      if (!lines) {
        return html`
          <div class="launch-site-frame">
            <div class="launch-site-header">
              <strong class="launch-site-thread">${site.thread}</strong>
              <code class="launch-site-file">${site.file}:${site.line}</code>
            </div>
            <p class="muted"
              style="padding: 12px 16px;">Could not load source file <code>${site
                .file}</code>.</p>
          </div>
        `;
      }

      const guardSet = new Set(site.guardLines);
      const allLines = [...site.guardLines, site.line];
      const minLine = Math.min(...allLines);
      const maxLine = Math.max(...allLines);
      const startLine = Math.max(1, minLine - 3);
      const endLine = Math.min(lines.length, maxLine + 3);

      const snippetRows = [];
      for (let ln = startLine; ln <= endLine; ln++) {
        const text = lines[ln - 1] ?? "";
        const isGuard = guardSet.has(ln);
        const isLaunch = ln === site.line;

        const rowClasses = [
          "statement",
          isLaunch ? "is-launch has-warning" : "",
          isGuard ? "is-guard" : "",
        ]
          .filter(Boolean)
          .join(" ");

        let gutterIcon = html`<span class="gutter-icon"></span>`;
        if (isLaunch) {
          gutterIcon = html`
            <span class="gutter-icon warning" title="Mission Launch Call">
              ${renderIcon(AlertTriangle)}
            </span>
          `;
        } else if (isGuard) {
          gutterIcon = html`
            <span class="gutter-icon" style="color: var(--secondary);"
              title="Launch Guard Condition">
              ${renderIcon(AlertCircle)}
            </span>
          `;
        }

        const badge = isLaunch
          ? html`<span class="launch-badge call">Launch Call</span>`
          : isGuard
          ? html`<span class="launch-badge guard">Guard</span>`
          : nothing;

        snippetRows.push(html`
          <li class=${rowClasses} data-line=${ln}>
            <div class="gutter-col">
              ${gutterIcon}
              <span class="line-num">${ln}</span>
            </div>
            <span class="code-text">${text}</span>
            ${badge}
          </li>
        `);
      }

      return html`
        <div class="launch-site-frame">
          <div class="launch-site-header">
            <strong class="launch-site-thread">${site.thread}</strong>
            <code
              class="launch-site-file">${site
                .file} (Lines ${startLine}–${endLine})</code>
          </div>
          <ol class="statements launch-statements">
            ${snippetRows}
          </ol>
        </div>
      `;
    });
  }

  #missionFile(): string {
    return (
      this.#statements.find((s) =>
        s.file.toLowerCase().includes(this.#chart.mission.toLowerCase())
      )?.file ??
        this.#statements.find((s) => s.file.includes("missions/"))?.file ??
        this.#statements[0]?.file ??
        `missions/${this.#chart.mission}.txt`
    );
  }

  #externalFiles(): string[] {
    const missionFile = this.#missionFile();
    const files = new Set<string>();
    for (const c of this.#chart.conflicts) {
      for (const a of c.accesses) {
        if (a.file && a.file !== missionFile) {
          files.add(a.file);
        }
      }
    }
    return [...files].sort();
  }

  #externalFileList(filePath: string) {
    const lines = this.#readSourceLines(filePath);
    if (!lines) {
      return html`
        <div class="code-view" data-editor-view="file:${filePath}">
          <p class="muted"
            style="padding: 16px;">Could not load source file <code>${filePath}</code>.</p>
        </div>
      `;
    }

    const diagnosticsByLine = new Map<
      number,
      { severity: "error" | "warning"; message: string }
    >();
    for (const c of this.#chart.conflicts) {
      for (const a of c.accesses) {
        if (a.file === filePath) {
          diagnosticsByLine.set(a.line, {
            severity: "warning",
            message:
              `Conflict on global ${c.global} (${c.pair}) with ${a.script}`,
          });
        }
      }
    }

    const items = [];
    for (let ln = 1; ln <= lines.length; ln++) {
      const text = lines[ln - 1] ?? "";
      const diag = diagnosticsByLine.get(ln);
      const hasError = diag?.severity === "error";
      const hasWarning = diag?.severity === "warning";

      const classes = [
        "statement",
        hasError ? "has-error" : "",
        hasWarning ? "has-warning" : "",
      ]
        .filter(Boolean)
        .join(" ");

      let gutterIcon = html`<span class="gutter-icon"></span>`;
      if (hasError) {
        gutterIcon = html`<span class="gutter-icon error" title=${
          diag!.message
        }>${renderIcon(AlertCircle)}</span>`;
      } else if (hasWarning) {
        gutterIcon = html`<span class="gutter-icon warning" title=${
          diag!.message
        }>${renderIcon(AlertTriangle)}</span>`;
      }

      items.push(html`
        <li
          class=${classes}
          data-line=${ln}
          data-file=${filePath}
        >
          <div class="gutter-col">
            <span class="gutter-add-placeholder" aria-hidden="true"></span>
            ${gutterIcon}
            <span class="line-num">${ln}</span>
          </div>
          ${this.#renderCodeText(text, diag)}
        </li>
      `);
    }

    return html`
      <div class="code-view" data-editor-view="file:${filePath}">
        <ol class="statements">${items}</ol>
      </div>
    `;
  }

  #groupedConflicts(): {
    global: string;
    pair: string;
    opposingScripts: string[];
    isFiltered: boolean;
    filterKind: string;
    missionAccesses: Conflict["accesses"];
    opposingAccesses: Conflict["accesses"];
    firstMissionLine?: number;
    firstMissionFile?: string;
  }[] {
    const missionName = this.#chart.mission.toLowerCase();
    const missionFile = this.#missionFile();

    const groups = new Map<
      string,
      {
        global: string;
        pair: string;
        opposingScripts: Set<string>;
        missionAccesses: Conflict["accesses"];
        opposingAccesses: Conflict["accesses"];
      }
    >();

    for (const c of this.#chart.conflicts) {
      let missionAccs: Conflict["accesses"] = [];
      let opposingAccs: Conflict["accesses"] = [];

      if (c.pair === "trigger-mission") {
        opposingAccs = c.accesses;
      } else {
        missionAccs = c.accesses.filter(
          (a) =>
            a.script.toLowerCase() === missionName ||
            a.file === missionFile,
        );
        opposingAccs = c.accesses.filter(
          (a) =>
            a.script.toLowerCase() !== missionName &&
            a.file !== missionFile,
        );
      }

      const key = c.global;
      const existing = groups.get(key) ?? {
        global: c.global,
        pair: c.pair,
        opposingScripts: new Set<string>(),
        missionAccesses: [],
        opposingAccesses: [],
      };

      for (const a of opposingAccs) {
        if (a.script) {
          existing.opposingScripts.add(a.script);
        }
      }

      for (const a of missionAccs) {
        if (
          !existing.missionAccesses.some(
            (x) => x.file === a.file && x.line === a.line && x.kind === a.kind,
          )
        ) {
          existing.missionAccesses.push(a);
        }
      }
      for (const a of opposingAccs) {
        if (
          !existing.opposingAccesses.some(
            (x) => x.file === a.file && x.line === a.line && x.kind === a.kind,
          )
        ) {
          existing.opposingAccesses.push(a);
        }
      }
      groups.set(key, existing);
    }

    const list = [...groups.values()].map((g) => {
      g.missionAccesses.sort((a, b) => a.line - b.line);
      g.opposingAccesses.sort((a, b) => a.line - b.line);
      const firstMissionLine = g.missionAccesses[0]?.line;
      const firstMissionFile = g.missionAccesses[0]?.file ?? missionFile;
      const opposingScripts = [...g.opposingScripts].sort();

      const hasActive = opposingScripts.some(
        (s) => !isStartupScript(s) && !isLockedScript(s),
      );
      const hasStartup = opposingScripts.some((s) => isStartupScript(s));
      const hasLocked = opposingScripts.some((s) => isLockedScript(s));
      const isFiltered = opposingScripts.length > 0 && !hasActive;
      const filterKind = [
        hasStartup ? "startup" : "",
        hasLocked ? "locked" : "",
      ].filter(Boolean).join(" ");

      return {
        global: g.global,
        pair: g.pair,
        opposingScripts,
        isFiltered,
        filterKind,
        missionAccesses: g.missionAccesses,
        opposingAccesses: g.opposingAccesses,
        firstMissionLine,
        firstMissionFile,
      };
    });

    return list.sort((a, b) => {
      if (a.isFiltered !== b.isFiltered) {
        return a.isFiltered ? 1 : -1;
      }
      const aHasMission = a.missionAccesses.length > 0;
      const bHasMission = b.missionAccesses.length > 0;
      if (aHasMission !== bHasMission) {
        return aHasMission ? -1 : 1;
      }
      if (
        a.firstMissionLine !== undefined && b.firstMissionLine !== undefined
      ) {
        if (a.firstMissionLine !== b.firstMissionLine) {
          return a.firstMissionLine - b.firstMissionLine;
        }
      }
      return a.global.localeCompare(b.global);
    });
  }

  #problems() {
    const errors = this.#chart.errors ?? [];
    const groupedConflicts = this.#groupedConflicts();
    const activeConflicts = groupedConflicts.filter((g) => !g.isFiltered);
    const filteredConflicts = groupedConflicts.filter((g) => g.isFiltered);
    const activeCount = errors.length + activeConflicts.length;
    const totalCount = errors.length + groupedConflicts.length;

    const errorItems = [];
    for (const err of errors) {
      if (err.kind === "reach") {
        const isError = err.severity === "error";
        errorItems.push(html`
          <div class="problem-row" data-jump-file=${err
            .file} data-jump-line=${err.line}>
            <span class="gutter-icon ${isError ? "error" : "warning"}">
              ${renderIcon(isError ? AlertCircle : AlertTriangle)}
            </span>
            <strong>Line ${err.line}:</strong>
            <span>Reached from multiple states (${err.states.join(
              ", ",
            )}). ${isError
              ? "Control flow ambiguity."
              : "Refactor shared subroutine into a function."}</span>
          </div>
        `);
      } else if (err.kind === "unphrased") {
        errorItems.push(html`
          <div class="problem-row">
            <span class="gutter-icon error">
              ${renderIcon(AlertCircle)}
            </span>
            <strong>Unphrased:</strong>
            <span>Guard condition <code>${err
              .expression}</code> has no Phrasebook entry.</span>
          </div>
        `);
      }
    }

    const missionName = titleCase(this.#chart.mission);
    const conflictItems = groupedConflicts.map((g) => {
      const allAccesses = [
        ...g.missionAccesses,
        ...g.opposingAccesses,
      ];
      const jumpFile = g.firstMissionFile ?? allAccesses[0]?.file;
      const jumpLine = g.firstMissionLine ?? allAccesses[0]?.line;
      const opposingLabel = g.opposingScripts.length <= 3
        ? g.opposingScripts.join(", ")
        : `${g.opposingScripts.slice(0, 3).join(", ")} +${
          g.opposingScripts.length - 3
        }`;
      const pairText = g.pair === "trigger-mission"
        ? `Trigger Launch (${opposingLabel})`
        : `${missionName} ↔ ${opposingLabel}`;
      const summaryText = g.missionAccesses.length > 0
        ? `(${g.missionAccesses.length} in ${missionName}, ${g.opposingAccesses.length} in ${g.opposingScripts.length} ${
          g.opposingScripts.length === 1 ? "thread" : "threads"
        })`
        : `(${g.opposingAccesses.length} in ${g.opposingScripts.length} ${
          g.opposingScripts.length === 1 ? "thread" : "threads"
        })`;

      return html`
        <details
          class="tree-node problem-tree-node ${g.isFiltered
            ? "is-filtered"
            : ""}"
          data-filtered="${g.isFiltered ? "true" : "false"}"
          data-filter-kind="${g.filterKind}"
          data-conflict-text="${g.global.toLowerCase()} ${g.opposingScripts
            .join(" ").toLowerCase()}"
        >
          <summary class="tree-summary" data-jump-file=${jumpFile}
            data-jump-line=${jumpLine}>
            <span class="gutter-icon warning">
              ${renderIcon(AlertTriangle)}
            </span>
            <strong class="tree-title problem-global"><code>${g
              .global}</code></strong>
            <span class="problem-pair">${pairText}</span>
            <span class="tree-count">${summaryText}</span>
          </summary>
          <ul class="tree-children">
            ${allAccesses.map((a) =>
              html`
                <li class="tree-child-row" data-jump-file=${a.file}
                  data-jump-line=${a.line}>
                  <span class="line-badge">Line ${a.line}</span>
                  <span class="script-badge">${a.script}</span>
                  <span class="badge ${a.kind}">${a.kind}</span>
                  <code class="file-text">${a.file}</code>
                </li>
              `
            )}
          </ul>
        </details>
      `;
    });

    const startupCount = groupedConflicts.filter(
      (g) => g.isFiltered && g.filterKind.includes("startup"),
    ).length;
    const lockedCount = groupedConflicts.filter(
      (g) => g.isFiltered && g.filterKind.includes("locked"),
    ).length;

    return html`
      <div class="problems-panel">
        <div class="problems-header">
          <div class="problems-header-left">
            <span>Problems (<span id="visible-problems-count" data-active-count=${activeCount} data-total-count=${totalCount}>${activeCount}</span>)</span>
          </div>
          <div class="problems-header-actions">
            <input
              type="search"
              class="pane-find-box"
              id="problems-find"
              placeholder="Filter problems…"
              aria-label="Filter problems"
            >
            ${startupCount > 0
              ? html`
                <button
                  type="button"
                  class="filter-chip"
                  id="toggle-problems-startup"
                  data-filter="startup"
                  aria-pressed="false"
                  title="Show conflicts with startup scripts"
                >
                  Startup (${startupCount})
                </button>
              `
              : nothing}
            ${lockedCount > 0
              ? html`
                <button
                  type="button"
                  class="filter-chip"
                  id="toggle-problems-locked"
                  data-filter="locked"
                  aria-pressed="false"
                  title="Show conflicts with lock-respecting threads"
                >
                  Locked (${lockedCount})
                </button>
              `
              : nothing}
          </div>
        </div>
        <div class="problems-body tree-list">
          ${errorItems.length === 0 && conflictItems.length === 0
            ? html`
              <div class="problem-row muted"
                style="color: var(--muted); padding: 8px 12px;">No problems detected in this mission.</div>
            `
            : html`${errorItems}${conflictItems}`}
        </div>
      </div>
    `;
  }

  #orphans() {
    const orphans = this.#chart.marks.filter((_, i) =>
      this.#anchors[i] === null
    );
    if (orphans.length === 0) {
      return nothing;
    }
    const items = this.#chart.marks.flatMap((mark, i) => {
      if (this.#anchors[i] !== null) return [];
      const occurrence = mark.occurrence ?? 1;
      const target = this.nearest(mark.statementText);
      const accept = target
        ? html`
          <button
            type="button"
            class="text-button"
            data-accept
            data-to-text=${target.text}
            data-to-occurrence=${target.occurrence}
            data-to-line=${target.line}
          >Accept Suggestion</button>
        `
        : nothing;
      const label = mark.label
        ? html`<span class="mark">${mark.label}</span>`
        : nothing;
      return [html`
        <div
          class="orphan"
          data-text=${mark.statementText}
          data-occurrence=${occurrence}
          data-label=${mark.label ?? ""}
        >
          <code>${mark.statementText}</code>
          ${label}
          ${accept}
          <button
            type="button"
            class="icon-button danger"
            title="Remove"
            aria-label=${`Remove orphaned mark on statement "${mark.statementText}"`}
            data-remove
          >
            ${renderIcon(Trash2)}
          </button>
        </div>
      `];
    });

    return html`
      <details class="orphans-drawer" open>
        <summary class="orphans-header">
          ${renderIcon(AlertTriangle)}
          <span>${orphans.length} Orphaned ${orphans.length === 1
            ? "Mark"
            : "Marks"}</span>
        </summary>
        <div class="orphans-list">${items}</div>
      </details>
    `;
  }

  #states() {
    if (this.#chart.states.length === 0) {
      return html`<p class="muted">No states defined.</p>`;
    }
    return this.#chart.states.map((state, i) => {
      const name = state.label ?? `State ${i + 1}`;
      const transitions = state.transitions.map((t) =>
        html`
          <li><code>${t.guard || "Always"}</code> to ${t.target}</li>
        `
      );
      return html`
        <div class="data-card">
          <div class="data-card-title">
            <strong>${name}</strong>
          </div>
          <ul style="margin: 6px 0 0 16px; padding: 0;">${transitions}</ul>
        </div>
      `;
    });
  }

  #statementList() {
    const markAt = new Map<Statement, number>();
    this.#anchors.forEach((statement, i) => {
      if (statement) markAt.set(statement, i);
    });

    const missionFile = this.#missionFile();
    const diagnosticsByLine = new Map<
      number,
      { severity: "error" | "warning"; message: string }
    >();

    const activeConflicts = this.#groupedConflicts().filter((g) =>
      !g.isFiltered
    );
    for (const g of activeConflicts) {
      for (const a of g.missionAccesses) {
        if (a.file === missionFile) {
          diagnosticsByLine.set(a.line, {
            severity: "warning",
            message: `Conflict on global ${g.global} (${g.pair}) with ${
              g.opposingScripts.join(", ")
            }`,
          });
        }
      }
    }

    for (const e of this.#chart.errors ?? []) {
      if (e.kind === "reach") {
        diagnosticsByLine.set(e.line, {
          severity: e.severity,
          message: `Reached from multiple states (${e.states.join(", ")}). ${
            e.severity === "error"
              ? "Control flow ambiguity."
              : "Refactor subroutine into function."
          }`,
        });
      }
    }

    const lines = this.#readSourceLines(missionFile);
    if (lines) {
      const stmtsByLine = new Map<number, Statement[]>();
      for (const s of this.#statements) {
        if (s.file === missionFile) {
          const list = stmtsByLine.get(s.line) ?? [];
          list.push(s);
          stmtsByLine.set(s.line, list);
        }
      }

      const items = [];
      for (let ln = 1; ln <= lines.length; ln++) {
        const text = lines[ln - 1] ?? "";
        const stmtsOnLine = stmtsByLine.get(ln);
        const s = stmtsOnLine
          ? (stmtsOnLine.find((stmt) => markAt.has(stmt)) ?? stmtsOnLine[0])
          : undefined;

        const i = s ? markAt.get(s) : undefined;
        const mark = i === undefined ? undefined : this.#chart.marks[i];
        const diag = diagnosticsByLine.get(ln);
        const hasError = diag?.severity === "error";
        const hasWarning = diag?.severity === "warning";

        const classes = [
          "statement",
          hasError ? "has-error" : "",
          hasWarning ? "has-warning" : "",
        ]
          .filter(Boolean)
          .join(" ");

        let gutterIcon = html`<span class="gutter-icon"></span>`;
        if (hasError) {
          gutterIcon = html`<span class="gutter-icon error" title=${
            diag!.message
          }>${renderIcon(AlertCircle)}</span>`;
        } else if (hasWarning) {
          gutterIcon = html`<span class="gutter-icon warning" title=${
            diag!.message
          }>${renderIcon(AlertTriangle)}</span>`;
        }

        const gutterAdd = s
          ? html`
            <button
              type="button"
              class="gutter-add"
              title="Add Story-Beat Split"
              aria-label=${`Add story-beat split before line ${ln}`}
            >
              ${renderIcon(Plus, 14)}
            </button>
          `
          : nothing;

        if (mark) {
          items.push(html`
            <li
              class="mark-divider"
              data-text=${mark.statementText}
              data-occurrence=${mark.occurrence ?? 1}
            >
              <div class="mark-divider-rail"></div>
              <div class="mark-divider-pill">
                <span class="mark-divider-icon">${renderIcon(
                  Bookmark,
                  12,
                )}</span>
                <strong class="mark-divider-label">${mark.label ||
                  "Story Beat"}</strong>
                <span class="mark-divider-tag">Beat Division</span>
                <button
                  type="button"
                  class="mark-remove-btn"
                  title="Remove mark"
                  aria-label=${`Remove mark "${
                    mark.label || mark.statementText
                  }"`}
                  data-mark-remove
                >
                  ${renderIcon(Trash2, 11)}
                </button>
              </div>
              <div class="mark-divider-rail"></div>
            </li>
          `);
        }

        items.push(html`
          <li
            class=${classes}
            data-line=${ln}
            data-text=${s?.text ?? nothing}
            data-occurrence=${s?.occurrence ?? nothing}
          >
            <div class="gutter-col">
              ${gutterAdd}
              ${gutterIcon}
              <span class="line-num">${ln}</span>
            </div>
            ${this.#renderCodeText(text, diag)}
          </li>
        `);
      }

      return html`<ol class="statements">${items}</ol>`;
    }

    const fileLinesCache = new Map<string, string[] | undefined>();
    const getLines = (file: string) => {
      if (!fileLinesCache.has(file)) {
        fileLinesCache.set(file, this.#readSourceLines(file));
      }
      return fileLinesCache.get(file);
    };

    const items = this.#statements.flatMap((s) => {
      const i = markAt.get(s);
      const mark = i === undefined ? undefined : this.#chart.marks[i];
      const diag = diagnosticsByLine.get(s.line);
      const hasError = diag?.severity === "error";
      const hasWarning = diag?.severity === "warning";

      const lines = getLines(s.file);
      const sourceLine = lines?.[s.line - 1] ?? "";
      const displayText = sourceLine || s.text;

      const classes = [
        "statement",
        hasError ? "has-error" : "",
        hasWarning ? "has-warning" : "",
      ]
        .filter(Boolean)
        .join(" ");

      let gutterIcon = html`<span class="gutter-icon"></span>`;
      if (hasError) {
        gutterIcon = html`<span class="gutter-icon error" title=${
          diag!.message
        }>${renderIcon(AlertCircle)}</span>`;
      } else if (hasWarning) {
        gutterIcon = html`<span class="gutter-icon warning" title=${
          diag!.message
        }>${renderIcon(AlertTriangle)}</span>`;
      }

      const res = [];
      if (mark) {
        res.push(html`
          <li
            class="mark-divider"
            data-text=${mark.statementText}
            data-occurrence=${mark.occurrence ?? 1}
          >
            <div class="mark-divider-rail"></div>
            <div class="mark-divider-pill">
              <span class="mark-divider-icon">${renderIcon(Bookmark, 12)}</span>
              <strong class="mark-divider-label">${mark.label ||
                "Story Beat"}</strong>
              <span class="mark-divider-tag">Beat Division</span>
              <button
                type="button"
                class="mark-remove-btn"
                title="Remove mark"
                aria-label=${`Remove mark "${
                  mark.label || mark.statementText
                }"`}
                data-mark-remove
              >
                ${renderIcon(Trash2, 11)}
              </button>
            </div>
            <div class="mark-divider-rail"></div>
          </li>
        `);
      }

      res.push(html`
        <li
          class=${classes}
          data-line=${s.line}
          data-text=${s.text}
          data-occurrence=${s.occurrence}
        >
          <div class="gutter-col">
            <button
              type="button"
              class="gutter-add"
              title="Add Story-Beat Split"
            aria-label=${`Add story-beat split before line ${s.line}`}
            >
              ${renderIcon(Plus, 14)}
            </button>
            ${gutterIcon}
            <span class="line-num">${s.line}</span>
          </div>
          ${this.#renderCodeText(displayText, diag)}
        </li>
      `);
      return res;
    });

    return html`<ol class="statements">${items}</ol>`;
  }

  #renderCodeText(
    text: string,
    diag?: { severity: "error" | "warning"; message: string },
  ) {
    if (!diag) {
      return html`<span class="code-text">${text}</span>`;
    }
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    const middle = text.slice(leading.length, text.length - trailing.length);
    if (!middle) {
      return html`<span class="code-text" title=${diag.message}>${text}</span>`;
    }
    const squiggleClass = diag.severity === "error"
      ? "squiggle-error"
      : "squiggle-warning";
    return html`
      <span class="code-text"
        title=${diag
          .message}>${leading}<span class=${squiggleClass}>${middle}</span>${trailing}</span>
    `;
  }

  #traces() {
    if (this.#chart.traces.length === 0) {
      return html`<p class="muted">No traces recorded.</p>`;
    }
    return this.#chart.traces.map((t) =>
      html`
        <div class="trace-card">
          <div class="trace-summary">
            <strong>${t.script}</strong>
            <div class="trace-tags">
              <span class="badge lock-${t.lock}">Lock: ${t.lock}</span>
              <span class="badge">Bound: ${t.bound}</span>
              ${t.cut ? html`<span class="badge write">Cut</span>` : nothing}
            </div>
          </div>
          <div class="trace-steps">
            ${t.effects.map((e, idx) =>
              html`
                <div class="effect-step">
                  <span class="step-num">${idx + 1}.</span>
                  <code>${e}</code>
                </div>
              `
            )}
          </div>
        </div>
      `
    );
  }
}
