/**
 * @module
 * Renders one mission's chart JSON and its statements as a single self-contained dark HTML page.
 * The page holds the globals, launch sites, conflicts, errors, orphaned marks, states, statements, and
 * traces, with a mark control on each statement. Orphans are marks whose statement no longer exists;
 * each one gets the nearest statement by Levenshtein distance as its Accept Suggestion target.
 *
 * @remarks
 * The page is dark only, with the dark tokens of `docs/palette.csv`. Ties in Levenshtein distance go to the
 * earlier statement in source order. Discarding an orphan shows an undo message for 8 seconds.
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

type Conflict = ChartFile["conflicts"][number];
type ConflictAccess = Conflict["accesses"][number];

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
              data-nav-problem="error"
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
              data-nav-problem="warning"
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
            <div class="trace-switcher">
              <label for="trace-select" class="trace-switcher-label">Trace:</label>
              <select id="trace-select" class="trace-select" aria-label="Select execution trace">
                <option value="">None (Code View)</option>
                ${this.#chart.traces.map((t, idx) => {
                  const outcome = t.cut
                    ? "loop"
                    : ((t.effects || []).join(" ").toLowerCase().match(
                        /fail|wasted|bust/,
                      )
                      ? "fail"
                      : "pass");
                  const steps = t.effects?.length ?? 0;
                  const label = `Trace #${
                    idx + 1
                  }: ${t.script} [${outcome.toUpperCase()}] (${steps} steps)`;
                  return html`<option value="${idx}">${label}</option>`;
                })}
              </select>
            </div>
          </div>
          <div class="editor-view-container">
            <div class="code-view active" data-editor-view="script">
              <div class="trace-gutter-rails-container">
                <svg class="trace-gutter-rails" aria-hidden="true"></svg>
              </div>
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
          </div>
          <div class="inspector-content">
            <div class="inspector-pane active" data-inspector-pane="globals">
              ${this.#globals()}
            </div>
            <div class="inspector-pane" data-inspector-pane="states">
              ${this.#states()}
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
    <dialog id="phrase-dialog" class="phrase-modal">
      <form method="dialog" class="phrase-form">
        <div class="modal-header">
          <h2 class="modal-title">Define Phrase</h2>
          <button type="button" class="tab-close" data-phrase-cancel aria-label="Close">×</button>
        </div>
        <p class="muted">Add or edit Gherkin English phrases for this condition in <code>Phrasebook.csv</code>.</p>
        <div class="field-group">
          <label for="phrase-expr">Expression</label>
          <input type="text" id="phrase-expr" name="expression" readonly>
        </div>
        <div class="field-group">
          <label for="phrase-nominal">Nominal (State, e.g. "the player is playing")</label>
          <input type="text" id="phrase-nominal" name="nominal" required>
        </div>
        <div class="field-group">
          <label for="phrase-opposite">Opposite (Negated state, e.g. "the player is not playing")</label>
          <input type="text" id="phrase-opposite" name="opposite" required>
        </div>
        <div class="field-group">
          <label for="phrase-active">Active (Event, e.g. "the player starts playing")</label>
          <input type="text" id="phrase-active" name="active" placeholder="Optional event phrase">
        </div>
        <div class="modal-actions">
          <button type="button" class="text-button" data-phrase-cancel>Cancel</button>
          <button type="submit" class="btn-primary" id="phrase-save">Save Phrase</button>
        </div>
      </form>
    </dialog>
    <div id="phrase-popover" class="phrase-popover" role="dialog" aria-label="Translate condition phrase" hidden>
      <div class="phrase-popover-header">
        <span class="phrase-popover-title">Translate Condition</span>
        <button type="button" class="phrase-popover-close" data-popover-close aria-label="Close popover">×</button>
      </div>
      <div class="phrase-popover-expr">
        <code id="phrase-popover-expr-text"></code>
      </div>
      <div class="phrase-popover-body">
        <div id="phrase-popover-loading" class="phrase-popover-loading" hidden>
          <span class="spinner" aria-hidden="true"></span>
          <span>Loading suggestions…</span>
        </div>
        <div id="phrase-popover-suggestions" class="phrase-popover-suggestions" hidden>
          <span class="phrase-popover-label">Suggestions:</span>
          <div id="phrase-suggestion-chips" class="phrase-suggestion-chips"></div>
        </div>
        <div class="phrase-popover-field">
          <label for="phrase-popover-input" class="phrase-popover-label">Gherkin Phrase</label>
          <input type="text" id="phrase-popover-input" class="phrase-popover-input" placeholder="e.g. the player is playing" autocomplete="off">
        </div>
      </div>
      <div class="phrase-popover-footer">
        <div class="phrase-popover-hints">
          <span class="keyboard-hint"><kbd>Enter</kbd> to save</span>
          <span class="keyboard-hint"><kbd>Esc</kbd> to close</span>
        </div>
        <div class="phrase-popover-actions">
          <button type="button" class="text-button" data-popover-close>Cancel</button>
          <button type="button" class="btn-primary" id="phrase-popover-save">Save</button>
        </div>
      </div>
    </div>
    <div id="trace-scrubber" class="trace-scrubber" role="toolbar" aria-label="Trace step scrubber" hidden>
      <div class="trace-scrubber-info">
        <span class="trace-scrubber-title" id="trace-scrubber-title">Trace #1</span>
        <span class="trace-scrubber-badge" id="trace-scrubber-badge">PASS</span>
        <span class="trace-scrubber-counter" id="trace-scrubber-step">Step 1 / 1</span>
      </div>
      <div class="trace-scrubber-controls">
        <button type="button" class="trace-btn trace-btn-prev" id="trace-prev" title="Previous step (p)" aria-label="Previous step">
          <kbd>p</kbd> Prev
        </button>
        <button type="button" class="trace-btn trace-btn-next" id="trace-next" title="Next step (n)" aria-label="Next step">
          Next <kbd>n</kbd>
        </button>
        <button type="button" class="trace-btn trace-btn-close" id="trace-close" title="Close trace (Esc)" aria-label="Close trace viewer">
          × <kbd>Esc</kbd>
        </button>
      </div>
    </div>
    <template id="trace-branch-card-template">
      <div class="trace-branch-card">
        <div class="trace-branch-header">
          <span class="trace-branch-badge">Branch</span>
          <span class="trace-branch-condition"></span>
          <span class="trace-branch-arrow">→</span>
          <span class="trace-branch-dest"></span>
          <button type="button" class="trace-branch-toggle" aria-label="Toggle details">▼</button>
        </div>
        <div class="trace-branch-details">
          <div class="trace-branch-detail-row">
            <span class="muted">Outcome:</span>
            <span class="trace-branch-outcome"></span>
          </div>
          <div class="trace-branch-detail-row">
            <span class="muted">Destination:</span>
            <span class="trace-branch-target"></span>
          </div>
        </div>
      </div>
    </template>
    <script id="chart-traces-data" type="application/json">
${JSON.stringify(this.#chart.traces)}
    </script>
    <script type="module" src="/static/chart.js"></script>
  </body>
</html>`;
  }

  #groupedGlobals(): {
    name: string;
    accessors: {
      accessor: string;
      kinds: string[];
      filterKind: string;
    }[];
    filterKind: string;
    isFiltered: boolean;
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
              data-nav-global=${g.name}
              data-filter-kind=${g.filterKind}
            >
              <summary class="tree-summary" ${jumpAttrs} data-nav-global=${g
                .name}>
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
                      data-nav-global=${g.name}
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

        const rawExpr = text.replace(/^\s*(if|and|or)\s+/i, "").trim();
        const badge = isLaunch
          ? html`<span class="launch-badge call">Launch Call</span>`
          : isGuard
          ? html`
            <span class="launch-badge guard phrase-badge" data-expression=${rawExpr}
              data-phrase=""
              title="Translate phrase">Guard <span class="phrase-edit-icon" aria-hidden="true">✎</span></span>
          `
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
    const globalsByLine = new Map<number, Set<string>>();
    const problemsByLine = new Map<number, Set<string>>();
    for (const c of this.#chart.conflicts) {
      for (const a of c.accesses) {
        if (a.file === filePath) {
          diagnosticsByLine.set(a.line, {
            severity: "warning",
            message:
              `Conflict on global ${c.global} (${c.pair}) with ${a.script}`,
          });
          if (!globalsByLine.has(a.line)) globalsByLine.set(a.line, new Set());
          globalsByLine.get(a.line)!.add(c.global);
          if (!problemsByLine.has(a.line)) {
            problemsByLine.set(a.line, new Set());
          }
          problemsByLine.get(a.line)!.add(`conflict:${c.global}`);
          problemsByLine.get(a.line)!.add("warning");
        }
      }
    }

    const items = [];
    for (let ln = 1; ln <= lines.length; ln++) {
      const text = lines[ln - 1] ?? "";
      const diag = diagnosticsByLine.get(ln);
      const hasError = diag?.severity === "error";
      const hasWarning = diag?.severity === "warning";

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

      const lineVars = text.match(/\$[A-Za-z0-9_]+/g);
      if (lineVars) {
        if (!globalsByLine.has(ln)) globalsByLine.set(ln, new Set());
        const set = globalsByLine.get(ln)!;
        for (const v of lineVars) set.add(v);
      }

      items.push(
        this.#renderStatement(
          undefined,
          ln - 1,
          ln,
          text,
          diag,
          [...(globalsByLine.get(ln) ?? [])],
          [...(problemsByLine.get(ln) ?? [])],
          html`<span class="gutter-add-placeholder" aria-hidden="true"></span>`,
          gutterIcon,
          filePath,
        ),
      );
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
            (x: ConflictAccess) =>
              x.file === a.file && x.line === a.line && x.kind === a.kind,
          )
        ) {
          existing.missionAccesses.push(a);
        }
      }
      for (const a of opposingAccs) {
        if (
          !existing.opposingAccesses.some(
            (x: ConflictAccess) =>
              x.file === a.file && x.line === a.line && x.kind === a.kind,
          )
        ) {
          existing.opposingAccesses.push(a);
        }
      }
      groups.set(key, existing);
    }

    const list = [...groups.values()].map((g) => {
      g.missionAccesses.sort((a: ConflictAccess, b: ConflictAccess) =>
        a.line - b.line
      );
      g.opposingAccesses.sort((a: ConflictAccess, b: ConflictAccess) =>
        a.line - b.line
      );
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
    const activeCount = errors.length + activeConflicts.length;
    const totalCount = errors.length + groupedConflicts.length;

    const errorItems = [];
    for (const err of errors) {
      if (err.kind === "reach") {
        const isError = err.severity === "error";
        errorItems.push(html`
          <div
            class="problem-row"
            data-nav-problem="reach:${err.line}"
            data-problem-severity=${err.severity}
            data-jump-file=${err.file}
            data-jump-line=${err.line}
          >
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
          <div
            class="problem-row"
            data-nav-problem="unphrased:${err.expression}"
            data-unphrased="${err.expression}"
          >
            <span class="gutter-icon error">
              ${renderIcon(AlertCircle)}
            </span>
            <strong>Unphrased:</strong>
            <span>Guard condition <span class="phrase-badge" data-expression=${err
              .expression} data-phrase="" title="Translate phrase"><code>${err
              .expression}</code> <span class="phrase-edit-icon" aria-hidden="true">✎</span></span> has no Phrasebook entry.</span>
            <button type="button" class="text-button btn-inline phrase-badge"
              data-expression=${err.expression}
              data-phrase=""
              data-open-phrase="${err.expression}">Define Phrase</button>
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
          data-nav-global="${g.global}"
          data-nav-problem="conflict:${g.global}"
          data-conflict-text="${g.global.toLowerCase()} ${g.opposingScripts
            .join(" ").toLowerCase()}"
        >
          <summary
            class="tree-summary"
            data-nav-global="${g.global}"
            data-nav-problem="conflict:${g.global}"
            data-jump-file=${jumpFile}
            data-jump-line=${jumpLine}
          >
            <span class="gutter-icon warning">
              ${renderIcon(AlertTriangle)}
            </span>
            <strong class="tree-title problem-global"
              data-nav-global="${g.global}"><code>${g
                .global}</code></strong>
            <span class="problem-pair">${pairText}</span>
            <span class="tree-count">${summaryText}</span>
          </summary>
          <ul class="tree-children">
            ${allAccesses.map((a) =>
              html`
                <li
                  class="tree-child-row"
                  data-nav-global="${g.global}"
                  data-nav-problem="conflict:${g.global}"
                  data-jump-file=${a.file}
                  data-jump-line=${a.line}
                >
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
      const transitions = state.transitions.map((t) => {
        if (!t.guard || t.guard === "Always") {
          return html`<li><code>${
            t.guard || "Always"
          }</code> to ${t.target}</li>`;
        }
        const expr = t.guard.replace(/^When\s+(not\s+)?/i, "").trim();
        return html`
          <li><span class="phrase-badge" data-expression=${expr} data-phrase=${t
            .guard} title="Edit phrase"><code>${t
            .guard}</code> <span class="phrase-edit-icon" aria-hidden="true">✎</span></span> to ${t
            .target}</li>
        `;
      });
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
    const globalsByLine = new Map<number, Set<string>>();
    const problemsByLine = new Map<number, Set<string>>();

    const groupedConflicts = this.#groupedConflicts();
    for (const g of groupedConflicts) {
      for (const a of g.missionAccesses) {
        if (a.file === missionFile) {
          if (!g.isFiltered) {
            diagnosticsByLine.set(a.line, {
              severity: "warning",
              message: `Conflict on global ${g.global} (${g.pair}) with ${
                g.opposingScripts.join(", ")
              }`,
            });
          }
          if (!globalsByLine.has(a.line)) globalsByLine.set(a.line, new Set());
          globalsByLine.get(a.line)!.add(g.global);
          if (!problemsByLine.has(a.line)) {
            problemsByLine.set(a.line, new Set());
          }
          problemsByLine.get(a.line)!.add(`conflict:${g.global}`);
          problemsByLine.get(a.line)!.add("warning");
        }
      }
    }

    for (const e of this.#chart.errors ?? []) {
      if (e.kind === "reach" && (!e.file || e.file === missionFile)) {
        diagnosticsByLine.set(e.line, {
          severity: e.severity,
          message: `Reached from multiple states (${e.states.join(", ")}). ${
            e.severity === "error"
              ? "Control flow ambiguity."
              : "Refactor subroutine into function."
          }`,
        });
        if (!problemsByLine.has(e.line)) problemsByLine.set(e.line, new Set());
        problemsByLine.get(e.line)!.add(`reach:${e.line}`);
        problemsByLine.get(e.line)!.add(e.severity);
      }
    }

    const unphrasedErrors = (this.#chart.errors ?? []).filter(
      (e): e is {
        kind: "unphrased";
        severity: "error" | "warning";
        expression: string;
      } => e.kind === "unphrased",
    );

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

        const matchedUnphrased = unphrasedErrors.find(
          (u) =>
            text.includes(u.expression) || u.expression.includes(text.trim()),
        );
        let conditionBadge: unknown = undefined;
        if (matchedUnphrased) {
          if (!problemsByLine.has(ln)) problemsByLine.set(ln, new Set());
          problemsByLine.get(ln)!.add(
            `unphrased:${matchedUnphrased.expression}`,
          );
          problemsByLine.get(ln)!.add("error");
          conditionBadge = html`
            <span class="phrase-badge unphrased-chip" data-expression=${matchedUnphrased
              .expression}
              data-phrase=""
              title="Translate phrase">Unphrased <span class="phrase-edit-icon" aria-hidden="true">✎</span></span>
          `;
        }

        const diag = diagnosticsByLine.get(ln);
        const hasError = diag?.severity === "error";
        const hasWarning = diag?.severity === "warning";

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
              title="Add Story Beat Split"
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
                <span class="mark-divider-tag">Story Beat Division</span>
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

        const lineVars = text.match(/\$[A-Za-z0-9_]+/g);
        if (lineVars) {
          if (!globalsByLine.has(ln)) globalsByLine.set(ln, new Set());
          const set = globalsByLine.get(ln)!;
          for (const v of lineVars) set.add(v);
        }

        items.push(
          this.#renderStatement(
            s,
            ln - 1,
            ln,
            text,
            diag,
            [...(globalsByLine.get(ln) ?? [])],
            [...(problemsByLine.get(ln) ?? [])],
            gutterAdd,
            gutterIcon,
            undefined,
            conditionBadge,
          ),
        );
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

    const items = this.#statements.flatMap((s, index) => {
      const i = markAt.get(s);
      const mark = i === undefined ? undefined : this.#chart.marks[i];

      const lines = getLines(s.file);
      const sourceLine = lines?.[s.line - 1] ?? "";
      const displayText = sourceLine || s.text;

      const matchedUnphrased = unphrasedErrors.find(
        (u) =>
          displayText.includes(u.expression) ||
          u.expression.includes(displayText.trim()),
      );
      let conditionBadge: unknown = undefined;
      if (matchedUnphrased) {
        if (!problemsByLine.has(s.line)) problemsByLine.set(s.line, new Set());
        problemsByLine.get(s.line)!.add(
          `unphrased:${matchedUnphrased.expression}`,
        );
        problemsByLine.get(s.line)!.add("error");
        conditionBadge = html`
          <span class="phrase-badge unphrased-chip" data-expression=${matchedUnphrased
            .expression}
            data-phrase=""
            title="Translate phrase">Unphrased <span class="phrase-edit-icon" aria-hidden="true">✎</span></span>
        `;
      }

      const diag = diagnosticsByLine.get(s.line);
      const hasError = diag?.severity === "error";
      const hasWarning = diag?.severity === "warning";

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
              <span class="mark-divider-tag">Story Beat Division</span>
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

      const lineVars = displayText.match(/\$[A-Za-z0-9_]+/g);
      if (lineVars) {
        if (!globalsByLine.has(s.line)) globalsByLine.set(s.line, new Set());
        const set = globalsByLine.get(s.line)!;
        for (const v of lineVars) set.add(v);
      }

      const gutterAdd = html`
        <button
          type="button"
          class="gutter-add"
          title="Add Story Beat Split"
          aria-label=${`Add story-beat split before line ${s.line}`}
        >
          ${renderIcon(Plus, 14)}
        </button>
      `;

      res.push(
        this.#renderStatement(
          s,
          index,
          s.line,
          displayText,
          diag,
          [...(globalsByLine.get(s.line) ?? [])],
          [...(problemsByLine.get(s.line) ?? [])],
          gutterAdd,
          gutterIcon,
          undefined,
          conditionBadge,
        ),
      );
      return res;
    });

    return html`<ol class="statements">${items}</ol>`;
  }

  #renderStatement(
    s: Statement | undefined,
    index: number,
    ln: number,
    text: string,
    diag?: { severity: "error" | "warning"; message: string },
    referencedGlobals: string[] = [],
    problemKeys: string[] = [],
    gutterAdd?: unknown,
    gutterIcon?: unknown,
    file?: string,
    badge?: unknown,
  ) {
    const hasError = diag?.severity === "error";
    const hasWarning = diag?.severity === "warning";
    const classes = [
      "statement",
      "statement-row",
      hasError ? "has-error" : "",
      hasWarning ? "has-warning" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const statementText = s?.text ?? text.trim();

    return html`
      <li
        class=${classes}
        data-line=${ln}
        data-statement-index=${index}
        data-statement-text=${statementText}
        data-text=${s?.text ?? nothing}
        data-occurrence=${s?.occurrence ?? nothing}
        data-globals=${referencedGlobals.length > 0
          ? referencedGlobals.join(" ")
          : nothing}
        data-problem=${problemKeys.length > 0 ? problemKeys.join(" ") : nothing}
        data-file=${file ?? nothing}
      >
        <div class="gutter-col">
          ${gutterAdd ?? nothing}
          ${gutterIcon ?? nothing}
          <span class="line-num">${ln}</span>
        </div>
        ${this.#renderCodeText(text, diag)}
        ${badge ?? nothing}
      </li>
    `;
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
}
