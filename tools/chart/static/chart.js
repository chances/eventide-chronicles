/**
 * @module
 * Client-side script for the IDE-style mission chart workspace.
 * Manages editor tab switching, inspector dock tabs, problem navigation, mark controls, and orphan resolution.
 */

const mission = document.body.dataset.mission ?? "";
const toast = document.querySelector(".toast");
let focused = null;
let timer = 0;

function activateEditorTab(target) {
  document.querySelectorAll("[data-editor-tab]").forEach((t) =>
    t.classList.remove("active")
  );
  document.querySelectorAll("[data-editor-view]").forEach((v) =>
    v.classList.remove("active")
  );
  const tab = document.querySelector(`[data-editor-tab="${target}"]`);
  const view = document.querySelector(`[data-editor-view="${target}"]`);
  tab?.classList.add("active");
  view?.classList.add("active");
  tab?.scrollIntoView({ behavior: "smooth", inline: "nearest" });
  if (
    target === "script" && typeof drawSvgRails === "function" &&
    activeTraceIndex >= 0
  ) {
    drawSvgRails(traceSteps, currentStepIndex);
  }
}

// Tab Switching (Editor tabs: Mission Script vs Launch Site vs dynamic files)
const editorTabsBar = document.querySelector(".editor-tabs");
if (editorTabsBar) {
  editorTabsBar.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-editor-tab]");
    if (tab && !e.target.closest(".tab-close")) {
      const target = tab.getAttribute("data-editor-tab");
      if (target) activateEditorTab(target);
    }
  });
}

// Inspector Tab Switching (Globals vs States vs Traces)
document.querySelectorAll("[data-inspector-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-inspector-tab]").forEach((t) =>
      t.classList.remove("active")
    );
    document.querySelectorAll("[data-inspector-pane]").forEach((p) =>
      p.classList.remove("active")
    );
    tab.classList.add("active");
    const target = tab.getAttribute("data-inspector-tab");
    document.querySelector(`[data-inspector-pane="${target}"]`)?.classList.add(
      "active",
    );
  });
});

// Jump to line from Problem chip, group header, or subrow
function highlightRow(row) {
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.style.background = "rgba(255, 122, 26, 0.25)";
  setTimeout(() => {
    row.style.background = "";
  }, 1500);
}

async function loadExternalFile(file) {
  let view = document.querySelector(`[data-editor-view="file:${file}"]`);
  if (view) return;

  const tabsContainer = document.querySelector(".editor-tabs");
  const viewContainer = document.querySelector(".editor-view-container");

  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "editor-tab";
  tab.setAttribute("data-editor-tab", `file:${file}`);
  tab.setAttribute("data-file", file);

  const label = document.createElement("span");
  label.textContent = file.split("/").pop() || file;
  tab.appendChild(label);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "tab-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close tab";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tab.remove();
    document.querySelector(`[data-editor-view="file:${file}"]`)?.remove();
    activateEditorTab("script");
  });
  tab.appendChild(closeBtn);
  tabsContainer?.appendChild(tab);

  view = document.createElement("div");
  view.className = "code-view";
  view.setAttribute("data-editor-view", `file:${file}`);
  view.innerHTML =
    `<p class="muted" style="padding: 16px;">Loading ${file}…</p>`;
  viewContainer?.appendChild(view);

  try {
    const res = await fetch(`/source?file=${encodeURIComponent(file)}`);
    if (!res.ok) throw new Error(await res.text());
    const content = await res.text();
    const lines = content.split(/\r?\n/);
    const list = document.createElement("ol");
    list.className = "statements";

    lines.forEach((text, idx) => {
      const ln = idx + 1;
      const li = document.createElement("li");
      li.className = "statement";
      li.dataset.line = String(ln);
      li.dataset.file = file;

      const gutter = document.createElement("div");
      gutter.className = "gutter-col";
      gutter.innerHTML =
        `<span class="gutter-add-placeholder" aria-hidden="true"></span><span class="gutter-icon"></span><span class="line-num">${ln}</span>`;

      const code = document.createElement("span");
      code.className = "code-text";
      code.textContent = text;

      li.appendChild(gutter);
      li.appendChild(code);
      list.appendChild(li);
    });

    view.innerHTML = "";
    view.appendChild(list);
  } catch (err) {
    view.innerHTML =
      `<p class="muted" style="padding: 16px;">Could not load source file <code>${file}</code>: ${err.message}</p>`;
  }
}

async function jumpTo(file, line) {
  const missionFile = document.body.dataset.missionFile || "";
  const isMission = !file || file === missionFile ||
    file.toLowerCase().includes(mission.toLowerCase());

  if (isMission) {
    activateEditorTab("script");
    const row = document.querySelector(
      `[data-editor-view="script"] .statement[data-line="${line}"]`,
    );
    if (row) highlightRow(row);
    return;
  }

  await loadExternalFile(file);
  activateEditorTab(`file:${file}`);
  const view = document.querySelector(`[data-editor-view="file:${file}"]`);
  const row = view?.querySelector(`.statement[data-line="${line}"]`);
  if (row) {
    highlightRow(row);
  }
}

// Synchronized Code Navigation & Inspector Pinning
let activeNav = {
  key: "",
  kind: "global",
  matches: [],
  currentIndex: 0,
  label: "",
};

function clearNav() {
  document
    .querySelectorAll(".statement.focused, .statement-row.focused")
    .forEach((r) => r.classList.remove("focused"));
  document
    .querySelectorAll(".statement.highlighted, .statement-row.highlighted")
    .forEach((r) => r.classList.remove("highlighted"));
  document.querySelectorAll(".gutter-pip").forEach((p) => p.remove());
  document.querySelectorAll(".scrollbar-marker").forEach((m) => m.remove());
  document.querySelector(".code-nav-bar")?.remove();
  activeNav = {
    key: "",
    kind: "global",
    matches: [],
    currentIndex: 0,
    label: "",
  };
}

function updateNavBar() {
  let navBar = document.querySelector(".code-nav-bar");
  if (!navBar) {
    const editorContainer = document.querySelector(".editor-view-container");
    if (!editorContainer) return;
    navBar = document.createElement("div");
    navBar.className = "code-nav-bar";
    navBar.innerHTML = `
      <span class="nav-label"></span>
      <button type="button" class="nav-btn nav-prev" title="Previous occurrence (Shift+F3)">▲</button>
      <button type="button" class="nav-btn nav-next" title="Next occurrence (F3)">▼</button>
      <button type="button" class="nav-close" title="Clear highlights (Esc)">×</button>
    `;
    navBar.querySelector(".nav-prev")?.addEventListener("click", (e) => {
      e.stopPropagation();
      stepNav(-1);
    });
    navBar.querySelector(".nav-next")?.addEventListener("click", (e) => {
      e.stopPropagation();
      stepNav(1);
    });
    navBar.querySelector(".nav-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearNav();
    });
    editorContainer.prepend(navBar);
  }
  const labelEl = navBar.querySelector(".nav-label");
  if (labelEl) {
    labelEl.textContent = `${activeNav.label}: ${
      activeNav.currentIndex + 1
    } of ${activeNav.matches.length}`;
  }
}

function stepNav(delta) {
  if (activeNav.matches.length === 0) return;
  activeNav.matches[activeNav.currentIndex]?.classList.remove("focused");
  activeNav.currentIndex =
    (activeNav.currentIndex + delta + activeNav.matches.length) %
    activeNav.matches.length;
  const current = activeNav.matches[activeNav.currentIndex];
  if (current) {
    current.classList.add("focused");
    current.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  updateNavBar();
}

function findStatementRows(
  predicate,
  viewSelector = '[data-editor-view="script"]',
) {
  const view = document.querySelector(viewSelector);
  if (!view) return [];
  const rows = Array.from(view.querySelectorAll(".statement, .statement-row"));
  return predicate ? rows.filter(predicate) : rows;
}

function syncNavigate(
  { key, kind, label, targetRows, initialFile, initialLine },
) {
  if (activeNav.key === key && activeNav.matches.length > 0) {
    stepNav(1);
    return;
  }

  clearNav();
  if (!targetRows || targetRows.length === 0) {
    if (initialLine) {
      jumpTo(initialFile, initialLine);
    }
    return;
  }

  activeNav = {
    key,
    kind,
    matches: targetRows,
    currentIndex: 0,
    label: label || key,
  };

  const container = document.querySelector(".editor-view-container");
  let markerTrack = container?.querySelector(".scrollbar-markers");
  if (container && !markerTrack) {
    markerTrack = document.createElement("div");
    markerTrack.className = "scrollbar-markers";
    container.appendChild(markerTrack);
  }

  const totalHeight = container?.scrollHeight || 1;

  targetRows.forEach((row) => {
    row.classList.add("highlighted");
    const gutterCol = row.querySelector(".gutter-col");
    const lineNum = gutterCol?.querySelector(".line-num");
    if (gutterCol && lineNum && !gutterCol.querySelector(".gutter-pip")) {
      const pip = document.createElement("span");
      pip.className = `gutter-pip ${kind}`;
      lineNum.before(pip);
    }

    if (markerTrack && container) {
      const topPct = (row.offsetTop / totalHeight) * 100;
      const marker = document.createElement("div");
      marker.className = `scrollbar-marker ${kind}`;
      marker.style.top = `${topPct}%`;
      markerTrack.appendChild(marker);
    }
  });

  const first = targetRows[0];
  first.classList.add("focused");
  first.scrollIntoView({ behavior: "smooth", block: "center" });

  if (targetRows.length > 1) {
    updateNavBar();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (activeNav.matches.length > 0) {
      clearNav();
    }
  } else if (e.key === "F3") {
    if (activeNav.matches.length > 0) {
      e.preventDefault();
      stepNav(e.shiftKey ? -1 : 1);
    }
  }
});

// Click handlers for synchronized navigation and jump-to
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof Element)) return;

  // Global chip or tree row click
  const globalEl = target.closest("[data-nav-global]");
  if (
    globalEl &&
    !target.closest(
      "button.tab-close, button.gutter-add, button.mark-remove-btn",
    )
  ) {
    const globalVar = globalEl.getAttribute("data-nav-global");
    if (globalVar) {
      const jumpFile = globalEl.getAttribute("data-jump-file");
      const jumpLine = globalEl.getAttribute("data-jump-line");
      const missionFile = document.body.dataset.missionFile || "";
      if (
        jumpFile && jumpFile !== missionFile &&
        !jumpFile.toLowerCase().includes(mission.toLowerCase())
      ) {
        jumpTo(jumpFile, jumpLine);
        return;
      }

      activateEditorTab("script");
      const needle = globalVar.toLowerCase();
      const rows = findStatementRows((row) => {
        const gAttr = row.getAttribute("data-globals");
        if (
          gAttr && gAttr.split(/\s+/).some((g) => g.toLowerCase() === needle)
        ) {
          return true;
        }
        const text = (
          row.getAttribute("data-statement-text") ||
          row.getAttribute("data-text") ||
          ""
        ).toLowerCase();
        return text.includes(needle);
      });

      syncNavigate({
        key: `global:${globalVar}`,
        kind: "global",
        label: globalVar,
        targetRows: rows,
        initialFile: jumpFile,
        initialLine: jumpLine,
      });
      return;
    }
  }

  // Problem chip, error row, or conflict card click
  const problemEl = target.closest("[data-nav-problem]");
  if (
    problemEl &&
    !target.closest(
      "button.tab-close, button.gutter-add, button.mark-remove-btn, button[data-open-phrase]",
    )
  ) {
    const problemKey = problemEl.getAttribute("data-nav-problem");
    const jumpFile = problemEl.getAttribute("data-jump-file");
    const jumpLine = problemEl.getAttribute("data-jump-line");
    const isWarning = problemKey === "warning" ||
      problemEl.classList.contains("warning");
    const kind = isWarning ? "warning" : "error";

    const missionFile = document.body.dataset.missionFile || "";
    if (
      jumpFile && jumpFile !== missionFile &&
      !jumpFile.toLowerCase().includes(mission.toLowerCase())
    ) {
      jumpTo(jumpFile, jumpLine);
      return;
    }

    activateEditorTab("script");
    let rows = [];
    if (problemKey === "error") {
      rows = findStatementRows((row) =>
        row.classList.contains("has-error") ||
        (row.getAttribute("data-problem") || "").includes("error")
      );
    } else if (problemKey === "warning") {
      rows = findStatementRows((row) =>
        row.classList.contains("has-warning") ||
        (row.getAttribute("data-problem") || "").includes("warning")
      );
    } else if (problemKey) {
      const needle = problemKey.toLowerCase();
      rows = findStatementRows((row) => {
        const pAttr = (row.getAttribute("data-problem") || "").toLowerCase();
        if (pAttr.includes(needle)) return true;
        if (jumpLine && row.getAttribute("data-line") === String(jumpLine)) {
          return true;
        }
        return false;
      });
    }

    syncNavigate({
      key: `problem:${problemKey}`,
      kind,
      label: problemKey?.startsWith("conflict:")
        ? problemKey.replace("conflict:", "Conflict ")
        : problemKey?.startsWith("reach:")
        ? `Reach Error (Line ${jumpLine || ""})`
        : problemKey === "error"
        ? "Errors"
        : problemKey === "warning"
        ? "Warnings"
        : problemKey || "Problem",
      targetRows: rows,
      initialFile: jumpFile,
      initialLine: jumpLine,
    });
    return;
  }

  // Fallback for jump-line links
  const jumpEl = target.closest("[data-jump-line]");
  if (jumpEl && !target.closest("button, details, summary")) {
    const line = jumpEl.getAttribute("data-jump-line");
    const file = jumpEl.getAttribute("data-jump-file");
    if (line) jumpTo(file, line);
  }
});

function applyProblemsFilter() {
  const panel = document.querySelector(".problems-panel");
  if (!panel) return;
  const query = (document.getElementById("problems-find")?.value ?? "").trim()
    .toLowerCase();
  const showStartup = panel.classList.contains("show-startup");
  const showLocked = panel.classList.contains("show-locked");

  let visibleCount = panel.querySelectorAll(".problem-row").length;
  panel.querySelectorAll("details.problem-tree-node").forEach((node) => {
    const text = node.dataset.conflictText ?? "";
    const filterKind = node.dataset.filterKind ?? "";
    const isFiltered = node.classList.contains("is-filtered");

    let allowed = true;
    if (isFiltered) {
      const matchStartup = showStartup && filterKind.includes("startup");
      const matchLocked = showLocked && filterKind.includes("locked");
      allowed = matchStartup || matchLocked;
    }

    const matchesQuery = !query || text.includes(query);
    const show = allowed && matchesQuery;
    node.style.display = show ? "block" : "none";
    if (show) visibleCount++;
  });

  const countEl = document.getElementById("visible-problems-count");
  if (countEl) countEl.textContent = String(visibleCount);
}

function applyGlobalsFilter() {
  const pane = document.querySelector(
    '.inspector-pane[data-inspector-pane="globals"]',
  );
  if (!pane) return;
  const query = (document.getElementById("globals-find")?.value ?? "").trim()
    .toLowerCase();
  const showStartup = pane.classList.contains("show-startup");
  const showLocked = pane.classList.contains("show-locked");

  let visibleCount = 0;
  pane.querySelectorAll("details.global-tree-node").forEach((node) => {
    const name = node.dataset.globalName ?? "";
    const filterKind = node.dataset.filterKind ?? "";
    const isFiltered = node.classList.contains("is-filtered");

    let allowed = true;
    if (isFiltered) {
      const matchStartup = showStartup && filterKind.includes("startup");
      const matchLocked = showLocked && filterKind.includes("locked");
      allowed = matchStartup || matchLocked;
    }

    const matchesQuery = !query || name.includes(query);
    const show = allowed && matchesQuery;
    node.style.display = show ? "block" : "none";
    if (show) visibleCount++;
  });

  const countEl = document.getElementById("visible-globals-count");
  if (countEl) countEl.textContent = String(visibleCount);
}

document.querySelectorAll(".filter-chip[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const isPressed = chip.getAttribute("aria-pressed") === "true";
    const nextState = !isPressed;
    const filter = chip.getAttribute("data-filter");
    if (!filter) return;

    // Tie filter state across both problems pane and globals sidebar
    document
      .querySelectorAll(`.filter-chip[data-filter="${filter}"]`)
      .forEach((c) => {
        c.setAttribute("aria-pressed", String(nextState));
        c.classList.toggle("active", nextState);
      });

    const problemsPanel = document.querySelector(".problems-panel");
    const globalsPane = document.querySelector(
      '.inspector-pane[data-inspector-pane="globals"]',
    );

    problemsPanel?.classList.toggle(`show-${filter}`, nextState);
    globalsPane?.classList.toggle(`show-${filter}`, nextState);

    applyProblemsFilter();
    applyGlobalsFilter();
  });
});

const globalsFind = document.getElementById("globals-find");
if (globalsFind) {
  globalsFind.addEventListener("input", applyGlobalsFilter);
}

const problemsFind = document.getElementById("problems-find");
if (problemsFind) {
  problemsFind.addEventListener("input", applyProblemsFilter);
}

// Rebuild Button
const rebuild = document.getElementById("rebuild");
const status = document.getElementById("status");
const rebuildLabel = rebuild?.querySelector("span");

if (rebuild && status && rebuildLabel) {
  rebuild.addEventListener("click", async () => {
    rebuild.setAttribute("disabled", "true");
    rebuild.setAttribute("aria-busy", "true");
    rebuildLabel.textContent = "Rebuilding…";
    status.textContent = "Rebuilding chart from source…";
    try {
      const response = await fetch("/" + mission + "/regenerate", {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      location.reload();
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : String(error);
      rebuild.removeAttribute("disabled");
      rebuild.removeAttribute("aria-busy");
      rebuildLabel.textContent = "Rebuild";
    }
  });
}

// Mark API calls
async function send(body) {
  const response = await fetch("/" + mission + "/marks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

function reload() {
  location.reload();
}

function report(error) {
  showToast(error instanceof Error ? error.message : String(error));
}

function showToast(message, actionLabel, onAction) {
  if (!toast) return;
  clearTimeout(timer);
  toast.textContent = "";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);
  if (actionLabel && onAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      toast.hidden = true;
      onAction();
    });
    toast.append(button);
  }
  toast.hidden = false;
  const undoMs = Number(toast.dataset.undoMs) || 8000;
  timer = setTimeout(() => {
    toast.hidden = true;
  }, undoMs);
}

function keyOf(el) {
  return {
    statementText: el.dataset.text ?? "",
    occurrence: Number(el.dataset.occurrence) || 1,
  };
}

function openForm(row) {
  if (row.previousElementSibling?.classList.contains("mark-form")) return;
  const form = document.createElement("form");
  form.className = "mark-form";
  const tag = document.createElement("span");
  tag.className = "mark-form-label";
  tag.textContent = "Split Story Beat:";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "label";
  input.placeholder = "Story beat label…";
  input.setAttribute("aria-label", "Story beat label");
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "text-button";
  save.textContent = "Save";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "text-button";
  cancel.textContent = "Cancel";
  form.append(tag, input, save, cancel);
  row.before(form);
  input.focus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send({
      action: "add",
      ...keyOf(row),
      label: input.value.trim() || undefined,
    }).then(reload, report);
  });
  cancel.addEventListener("click", () => form.remove());
}

document.addEventListener("mouseover", (e) => {
  const gutter = e.target.closest?.(".gutter-add");
  if (gutter) {
    gutter.closest(".statement")?.classList.add("preview-mark-divider");
  }
});

document.addEventListener("mouseout", (e) => {
  const gutter = e.target.closest?.(".gutter-add");
  if (gutter) {
    gutter.closest(".statement")?.classList.remove("preview-mark-divider");
  }
});

document.addEventListener("focusin", (e) => {
  const gutter = e.target.closest?.(".gutter-add");
  if (gutter) {
    gutter.closest(".statement")?.classList.add("preview-mark-divider");
  }
});

document.addEventListener("focusout", (e) => {
  const gutter = e.target.closest?.(".gutter-add");
  if (gutter) {
    gutter.closest(".statement")?.classList.remove("preview-mark-divider");
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const markRemove = target.closest("[data-mark-remove]");
  if (markRemove) {
    const divider = markRemove.closest(".mark-divider");
    if (!divider) return;
    const key = keyOf(divider);
    send({ action: "remove", ...key }).then(reload, report);
    return;
  }

  const accept = target.closest("[data-accept]");
  if (accept) {
    const orphan = accept.closest(".orphan");
    if (!orphan) return;
    send({
      action: "set",
      from: keyOf(orphan),
      to: {
        statementText: accept.getAttribute("data-to-text") ?? "",
        occurrence: Number(accept.getAttribute("data-to-occurrence")) || 1,
      },
    }).then(reload, report);
    return;
  }

  const remove = target.closest("[data-remove]");
  if (remove) {
    const orphan = remove.closest(".orphan");
    if (!orphan) return;
    const key = keyOf(orphan);
    const label = orphan.getAttribute("data-label") || undefined;
    send({ action: "remove", ...key }).then(() => {
      orphan.remove();
      showToast("Removed orphaned mark.", "Undo", () => {
        send({ action: "add", ...key, label }).then(reload, report);
      });
    }, report);
    return;
  }

  const orphanRow = target.closest(".orphan");
  if (orphanRow) {
    if (focused) focused.classList.remove("focused");
    focused = focused === orphanRow ? null : orphanRow;
    if (focused) focused.classList.add("focused");
    return;
  }

  const gutter = target.closest(".gutter-add");
  if (gutter) {
    const row = gutter.closest(".statement");
    if (!row) return;
    if (focused) {
      send({ action: "set", from: keyOf(focused), to: keyOf(row) }).then(
        reload,
        report,
      );
    } else {
      openForm(row);
    }
    return;
  }

  const row = target.closest(".statement");
  if (row && focused && row.dataset.text) {
    send({ action: "set", from: keyOf(focused), to: keyOf(row) }).then(
      reload,
      report,
    );
    return;
  }

  const phraseBadge = target.closest(".phrase-badge");
  if (phraseBadge) {
    const expr = phraseBadge.getAttribute("data-expression") ||
      phraseBadge.getAttribute("data-open-phrase");
    const currentPhrase = phraseBadge.getAttribute("data-phrase") || "";
    if (expr) {
      openPhrasePopover(expr, currentPhrase, phraseBadge);
      return;
    }
  }

  const phraseBtn = target.closest("[data-open-phrase]");
  if (phraseBtn) {
    const expr = phraseBtn.getAttribute("data-open-phrase");
    if (expr) openPhrasePopover(expr, "", phraseBtn);
    return;
  }

  const unphrasedRow = target.closest("[data-unphrased]");
  if (unphrasedRow && !target.closest("button")) {
    const expr = unphrasedRow.getAttribute("data-unphrased");
    if (expr) openPhrasePopover(expr, "", unphrasedRow);
    return;
  }
});

// Inline Phrase Popover Management
const phrasePopover = document.getElementById("phrase-popover");
const popoverExprText = document.getElementById("phrase-popover-expr-text");
const popoverLoading = document.getElementById("phrase-popover-loading");
const popoverSuggestions = document.getElementById(
  "phrase-popover-suggestions",
);
const popoverChips = document.getElementById("phrase-suggestion-chips");
const popoverInput = document.getElementById("phrase-popover-input");
const popoverSaveBtn = document.getElementById("phrase-popover-save");

let activePopoverBadge = null;
let activePopoverExpr = "";
let activePopoverSuggestedOpposite = "";

function positionPopover(anchorEl) {
  if (!phrasePopover || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const popoverWidth = phrasePopover.offsetWidth || 340;
  const popoverHeight = phrasePopover.offsetHeight || 220;

  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }
  if (left < 16) left = 16;

  let top = rect.bottom + 8;
  if (top + popoverHeight > window.innerHeight - 16) {
    top = Math.max(16, rect.top - popoverHeight - 8);
  }

  phrasePopover.style.top = `${top}px`;
  phrasePopover.style.left = `${left}px`;
}

async function openPhrasePopover(expression, currentPhrase, anchorEl) {
  if (!phrasePopover || !expression) return;
  activePopoverBadge = anchorEl;
  activePopoverExpr = expression;
  activePopoverSuggestedOpposite = "";

  if (popoverExprText) popoverExprText.textContent = expression;
  if (popoverInput) popoverInput.value = currentPhrase || "";
  if (popoverSuggestions) popoverSuggestions.hidden = true;
  if (popoverChips) popoverChips.innerHTML = "";
  if (popoverLoading) popoverLoading.hidden = false;

  phrasePopover.hidden = false;
  positionPopover(anchorEl);
  popoverInput?.focus();

  try {
    const res = await fetch(
      `/phrases/suggest?expression=${encodeURIComponent(expression)}`,
    );
    if (res.ok) {
      const data = await res.json();
      activePopoverSuggestedOpposite = data.opposite || "";
      const suggestions = [data.nominal, data.opposite, data.active].filter(
        Boolean,
      );
      if (popoverChips && suggestions.length > 0) {
        popoverChips.innerHTML = "";
        for (const s of suggestions) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "phrase-chip";
          chip.textContent = s;
          chip.addEventListener("click", () => {
            if (popoverInput) {
              popoverInput.value = s;
              popoverInput.focus();
            }
          });
          popoverChips.appendChild(chip);
        }
        if (popoverSuggestions) popoverSuggestions.hidden = false;
      }
      if (popoverInput && !popoverInput.value && data.nominal) {
        popoverInput.value = data.nominal;
      }
    }
  } catch (err) {
    console.error("Could not load suggestion:", err);
  } finally {
    if (popoverLoading) popoverLoading.hidden = true;
    positionPopover(anchorEl);
    popoverInput?.focus();
    popoverInput?.select();
  }
}

function closePhrasePopover() {
  if (!phrasePopover || phrasePopover.hidden) return;
  phrasePopover.hidden = true;
  activePopoverBadge?.focus();
}

async function savePhraseFromPopover() {
  const expr = activePopoverExpr;
  const phrase = popoverInput?.value.trim() ?? "";
  if (!expr || !phrase) return;

  if (popoverSaveBtn) popoverSaveBtn.disabled = true;

  try {
    const res = await fetch("/phrases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expression: expr,
        phrase: phrase,
        nominal: phrase,
        opposite: activePopoverSuggestedOpposite ||
          (phrase.startsWith("not ") ? phrase.slice(4) : `not ${phrase}`),
      }),
    });
    if (!res.ok) throw new Error(await res.text());

    const escapedExpr = typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(expr)
      : expr.replace(/["\\]/g, "\\$&");
    const badges = document.querySelectorAll(
      `.phrase-badge[data-expression="${escapedExpr}"], [data-open-phrase="${escapedExpr}"]`,
    );
    badges.forEach((b) => {
      b.setAttribute("data-phrase", phrase);
      b.setAttribute("title", `Phrase: "${phrase}"`);
      if (
        b.classList.contains("unphrased-chip") ||
        b.classList.contains("unphrased-badge")
      ) {
        b.textContent = phrase;
        b.classList.remove("unphrased-chip", "unphrased-badge");
      } else if (b.tagName === "BUTTON" && b.hasAttribute("data-open-phrase")) {
        b.textContent = phrase;
      } else {
        const codeEl = b.querySelector("code");
        if (codeEl) codeEl.textContent = phrase;
      }
    });

    showToast(`Phrase saved: "${phrase}"`);
    closePhrasePopover();
  } catch (err) {
    showToast(`Error saving phrase: ${err.message}`);
  } finally {
    if (popoverSaveBtn) popoverSaveBtn.disabled = false;
  }
}

popoverSaveBtn?.addEventListener("click", savePhraseFromPopover);

phrasePopover?.querySelectorAll("[data-popover-close]").forEach((btn) => {
  btn.addEventListener("click", closePhrasePopover);
});

phrasePopover?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    savePhraseFromPopover();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePhrasePopover();
  }
});

document.addEventListener("mousedown", (e) => {
  if (!phrasePopover || phrasePopover.hidden) return;
  if (!phrasePopover.contains(e.target) && !e.target.closest(".phrase-badge")) {
    closePhrasePopover();
  }
});

// Phrase Modal Management
const phraseDialog = document.getElementById("phrase-dialog");
const phraseForm = phraseDialog?.querySelector(".phrase-form");
const exprInput = document.getElementById("phrase-expr");
const nominalInput = document.getElementById("phrase-nominal");
const oppositeInput = document.getElementById("phrase-opposite");
const activeInput = document.getElementById("phrase-active");
let phraseTriggerEl = null;

async function openPhraseModal(expression, triggerEl) {
  if (!phraseDialog || !expression) return;
  phraseTriggerEl = triggerEl;
  if (exprInput) exprInput.value = expression;
  if (nominalInput) nominalInput.value = "";
  if (oppositeInput) oppositeInput.value = "";
  if (activeInput) activeInput.value = "";

  phraseDialog.showModal();
  nominalInput?.focus();

  try {
    const res = await fetch(
      `/phrases/suggest?expression=${encodeURIComponent(expression)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (exprInput && exprInput.value === expression) {
        if (nominalInput && !nominalInput.value) {
          nominalInput.value = data.nominal || "";
        }
        if (oppositeInput && !oppositeInput.value) {
          oppositeInput.value = data.opposite || "";
        }
        if (activeInput && !activeInput.value) {
          activeInput.value = data.active || "";
        }
      }
    }
  } catch (err) {
    console.error("Could not load suggestion:", err);
  }
}

function closePhraseModal() {
  if (!phraseDialog?.open) return;
  phraseDialog.close();
  phraseTriggerEl?.focus();
}

phraseDialog?.querySelectorAll("[data-phrase-cancel]").forEach((btn) => {
  btn.addEventListener("click", closePhraseModal);
});

phraseDialog?.addEventListener("click", (e) => {
  const rect = phraseDialog.getBoundingClientRect();
  const isInDialog = rect.top <= e.clientY &&
    e.clientY <= rect.top + rect.height &&
    rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!isInDialog) {
    closePhraseModal();
  }
});

phraseDialog?.addEventListener("cancel", () => {
  phraseTriggerEl?.focus();
});

phraseForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const expression = exprInput?.value.trim() ?? "";
  const nominal = nominalInput?.value.trim() ?? "";
  const opposite = oppositeInput?.value.trim() ?? "";
  const active = activeInput?.value.trim() ?? "";

  closePhraseModal();
  showToast(`Saving phrase for ${expression}…`);

  try {
    const res = await fetch("/phrases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expression, nominal, opposite, active }),
    });
    if (!res.ok) throw new Error(await res.text());

    showToast("Phrase saved. Rebuilding chart…");
    if (rebuild && status && rebuildLabel) {
      rebuild.setAttribute("disabled", "true");
      rebuild.setAttribute("aria-busy", "true");
      rebuild.classList.add("spinning");
      rebuildLabel.textContent = "Rebuilding…";
      status.textContent = "Rebuilding chart from source…";
    }

    const regenRes = await fetch("/" + mission + "/regenerate", {
      method: "POST",
    });
    if (!regenRes.ok) throw new Error(await regenRes.text());
    location.reload();
  } catch (err) {
    report(err);
    if (rebuild && rebuildLabel) {
      rebuild.removeAttribute("disabled");
      rebuild.removeAttribute("aria-busy");
      rebuild.classList.remove("spinning");
      rebuildLabel.textContent = "Rebuild";
    }
  }
});

// --- In-Editor Trace Viewer ---

let tracesData = [];
const tracesScriptEl = document.getElementById("chart-traces-data");
if (tracesScriptEl) {
  try {
    tracesData = JSON.parse(tracesScriptEl.textContent || "[]");
  } catch (err) {
    console.warn("Failed to parse traces data:", err);
  }
}

let activeTraceIndex = -1;
let currentStepIndex = 0;
let traceSteps = [];

function getTraceOutcome(t) {
  if (t.cut) return "loop";
  const str = (t.effects || []).join(" ").toLowerCase();
  if (str.includes("fail") || str.includes("wasted") || str.includes("bust")) {
    return "fail";
  }
  return "pass";
}

function normalizeCode(s) {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
}


function drawSvgRails(steps, currentIdx) {
  const svg = document.querySelector(".trace-gutter-rails");
  if (!svg || steps.length === 0) return;

  const codeView = document.querySelector('[data-editor-view="script"]');
  if (!codeView) return;

  const svgHeight = Math.max(codeView.scrollHeight, codeView.clientHeight);
  svg.setAttribute("height", `${svgHeight}px`);

  svg.innerHTML = `
    <defs>
      <marker id="trace-arrow-jump" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--primary)" />
      </marker>
    </defs>
  `;

  const x = 52;

  // Draw connecting rails
  for (let i = 0; i < steps.length - 1; i++) {
    const s1 = steps[i];
    const s2 = steps[i + 1];
    if (!s1.element || !s2.element) continue;

    const y1 = s1.element.offsetTop + s1.element.offsetHeight / 2;
    const y2 = s2.element.offsetTop + s2.element.offsetHeight / 2;
    const isJump = Math.abs(s2.line - s1.line) > 2;

    if (!isJump) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", x);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y2);
      line.setAttribute(
        "stroke",
        i < currentIdx ? "var(--primary)" : "var(--secondary)",
      );
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-opacity", i < currentIdx ? "0.9" : "0.5");
      svg.appendChild(line);
    } else {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const curveX = y2 > y1 ? x - 22 : x - 32;
      const d = `M ${x} ${y1} C ${curveX} ${y1}, ${curveX} ${y2}, ${x} ${y2}`;
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute(
        "stroke",
        i < currentIdx ? "var(--primary)" : "var(--primary)",
      );
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-dasharray", "4 2");
      path.setAttribute("marker-end", "url(#trace-arrow-jump)");
      svg.appendChild(path);
    }
  }

  // Draw step nodes
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.element) continue;
    const y = s.element.offsetTop + s.element.offsetHeight / 2;
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", i === currentIdx ? "6" : "3.5");
    circle.setAttribute(
      "fill",
      i === currentIdx
        ? "var(--primary)"
        : (i < currentIdx ? "var(--secondary)" : "var(--surface-raised)"),
    );
    circle.setAttribute(
      "stroke",
      i === currentIdx ? "#ffffff" : "var(--secondary)",
    );
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute(
      "class",
      `trace-rail-node ${i === currentIdx ? "active" : ""}`,
    );
    circle.style.cursor = "pointer";
    circle.style.pointerEvents = "auto";
    circle.title = `Step ${i + 1}: ${s.text}`;
    circle.addEventListener("click", () => goToStep(i));
    svg.appendChild(circle);
  }
}

function insertBranchCards(steps) {
  document.querySelectorAll(".trace-branch-card").forEach((card) =>
    card.remove()
  );
  const template = document.getElementById("trace-branch-card-template");
  if (!template) return;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.isJump || !step.element) continue;

    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".trace-branch-card");
    if (!card) continue;

    card.setAttribute("data-trace-step", i);

    const condEl = card.querySelector(".trace-branch-condition");
    if (condEl) condEl.textContent = step.condition || "Branch condition met";

    const destEl = card.querySelector(".trace-branch-dest");
    if (destEl) {
      destEl.innerHTML =
        `<a class="trace-branch-dest-link" data-jump-line="${step.targetLine}">Jump to Line ${step.targetLine}${
          step.targetLabel ? ` (${step.targetLabel})` : ""
        }</a>`;
    }

    const outcomeEl = card.querySelector(".trace-branch-outcome");
    if (outcomeEl) {
      outcomeEl.textContent = step.branchOutcome || "Branch taken (True)";
    }

    const targetEl = card.querySelector(".trace-branch-target");
    if (targetEl) {
      targetEl.textContent = step.targetLabel
        ? `${step.targetLabel} (Line ${step.targetLine})`
        : `Line ${step.targetLine}`;
    }

    const header = card.querySelector(".trace-branch-header");
    header?.addEventListener("click", (e) => {
      if (e.target.closest(".trace-branch-dest-link")) return;
      card.classList.toggle("collapsed");
    });

    const link = card.querySelector(".trace-branch-dest-link");
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      const targetRow = document.querySelector(
        `.statement-row[data-line="${step.targetLine}"]`,
      );
      if (targetRow) {
        highlightRow(targetRow);
      }
    });

    step.element.after(card);
  }
}

function goToStep(index) {
  if (index < 0 || index >= traceSteps.length) return;
  currentStepIndex = index;

  const stepCounter = document.getElementById("trace-scrubber-step");
  if (stepCounter) {
    stepCounter.textContent = `Step ${index + 1} / ${traceSteps.length}`;
  }

  const prevBtn = document.getElementById("trace-prev");
  const nextBtn = document.getElementById("trace-next");
  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) nextBtn.disabled = index === traceSteps.length - 1;

  document.querySelectorAll(".statement-row.trace-step-active").forEach((r) => {
    r.classList.remove("trace-step-active");
  });

  for (let i = 0; i < traceSteps.length; i++) {
    const el = traceSteps[i].element;
    if (!el) continue;
    if (i < index) {
      el.classList.add("trace-step-visited");
    } else {
      el.classList.remove("trace-step-visited");
    }
  }

  const activeStep = traceSteps[index];
  if (activeStep?.element) {
    activeStep.element.classList.add("trace-step-active");
    activeStep.element.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  drawSvgRails(traceSteps, currentStepIndex);
}

function activateTrace(traceIndex) {
  if (traceIndex < 0 || traceIndex >= tracesData.length) {
    deactivateTrace();
    return;
  }

  activeTraceIndex = traceIndex;
  const trace = tracesData[traceIndex];
  const outcome = getTraceOutcome(trace);

  activateEditorTab("script");

  const allRows = findStatementRows();
  traceSteps = [];

  let cursor = 0;
  const effects = trace.effects || [];

  for (let i = 0; i < effects.length; i++) {
    const eff = effects[i];
    const normEff = normalizeCode(eff);

    let matchedRow = null;
    let matchedIdx = -1;

    for (let j = cursor; j < allRows.length; j++) {
      const rowText = normalizeCode(
        allRows[j].getAttribute("data-statement-text") ||
          allRows[j].querySelector(".code-text")?.textContent,
      );
      if (
        rowText === normEff || rowText.includes(normEff) ||
        normEff.includes(rowText)
      ) {
        matchedRow = allRows[j];
        matchedIdx = j;
        break;
      }
    }

    if (!matchedRow) {
      for (let j = 0; j < cursor; j++) {
        const rowText = normalizeCode(
          allRows[j].getAttribute("data-statement-text") ||
            allRows[j].querySelector(".code-text")?.textContent,
        );
        if (
          rowText === normEff || rowText.includes(normEff) ||
          normEff.includes(rowText)
        ) {
          matchedRow = allRows[j];
          matchedIdx = j;
          break;
        }
      }
    }

    if (!matchedRow && allRows.length > 0) {
      matchedRow = allRows[Math.min(cursor, allRows.length - 1)];
      matchedIdx = cursor;
    }

    if (matchedRow) {
      cursor = (matchedIdx + 1) % allRows.length;
      const line = parseInt(matchedRow.getAttribute("data-line") || "0", 10);
      const text = matchedRow.getAttribute("data-statement-text") ||
        matchedRow.querySelector(".code-text")?.textContent || eff;
      traceSteps.push({
        stepNum: i + 1,
        line,
        text,
        element: matchedRow,
        effect: eff,
        isJump: false,
        targetLine: null,
        targetLabel: null,
        condition: null,
        branchOutcome: null,
      });
    }
  }

  for (let i = 0; i < traceSteps.length - 1; i++) {
    const s1 = traceSteps[i];
    const s2 = traceSteps[i + 1];
    const text1 = s1.text.toLowerCase();
    const isExplicitJump = /goto\b|goto_if_false\b|if\b|while\b/.test(text1);
    const isNonSequential = Math.abs(s2.line - s1.line) > 1;

    if (isExplicitJump || isNonSequential) {
      s1.isJump = true;
      s1.targetLine = s2.line;
      s1.targetLabel = s2.text.startsWith(":") ? s2.text : null;
      s1.condition = text1.includes("if") ? s1.text : "Branch Evaluated";
      s1.branchOutcome = `Branch taken → Line ${s2.line}`;
    }
  }

  const scrubber = document.getElementById("trace-scrubber");
  const titleEl = document.getElementById("trace-scrubber-title");
  const badgeEl = document.getElementById("trace-scrubber-badge");

  if (titleEl) {
    titleEl.textContent = `Trace #${traceIndex + 1}: ${trace.script}`;
  }
  if (badgeEl) {
    badgeEl.textContent = outcome.toUpperCase();
    badgeEl.className = `trace-scrubber-badge ${outcome}`;
  }

  if (scrubber) scrubber.hidden = false;

  insertBranchCards(traceSteps);
  goToStep(0);
}

function deactivateTrace() {
  activeTraceIndex = -1;
  traceSteps = [];

  const scrubber = document.getElementById("trace-scrubber");
  if (scrubber) scrubber.hidden = true;

  const traceSelect = document.getElementById("trace-select");
  if (traceSelect) traceSelect.value = "";

  document.querySelectorAll(".statement-row.trace-step-active").forEach((r) => {
    r.classList.remove("trace-step-active");
  });
  document.querySelectorAll(".statement-row.trace-step-visited").forEach(
    (r) => {
      r.classList.remove("trace-step-visited");
    },
  );
  document.querySelectorAll(".trace-branch-card").forEach((card) =>
    card.remove()
  );

  const svg = document.querySelector(".trace-gutter-rails");
  if (svg) svg.innerHTML = "";
}

// Trace UI Event Listeners
const traceSelectEl = document.getElementById("trace-select");
traceSelectEl?.addEventListener("change", () => {
  const val = traceSelectEl.value;
  if (val === "") {
    deactivateTrace();
  } else {
    activateTrace(parseInt(val, 10));
  }
});

document.getElementById("trace-prev")?.addEventListener("click", () => {
  if (currentStepIndex > 0) goToStep(currentStepIndex - 1);
});

document.getElementById("trace-next")?.addEventListener("click", () => {
  if (currentStepIndex < traceSteps.length - 1) goToStep(currentStepIndex + 1);
});

document.getElementById("trace-close")?.addEventListener("click", () => {
  deactivateTrace();
});

window.addEventListener("keydown", (e) => {
  if (activeTraceIndex === -1) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;

  if (e.key === "n" || e.key === "N" || e.key === "ArrowRight") {
    e.preventDefault();
    if (currentStepIndex < traceSteps.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  } else if (e.key === "p" || e.key === "P" || e.key === "ArrowLeft") {
    e.preventDefault();
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    deactivateTrace();
  }
});

window.addEventListener("resize", () => {
  if (activeTraceIndex >= 0) {
    drawSvgRails(traceSteps, currentStepIndex);
  }
});
