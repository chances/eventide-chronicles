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

document.querySelectorAll(
  ".problem-chip, .problem-row, summary[data-jump-line], .tree-child-row[data-jump-line]",
).forEach((el) => {
  el.addEventListener("click", () => {
    const line = el.getAttribute("data-jump-line");
    const file = el.getAttribute("data-jump-file");
    if (line) {
      jumpTo(file, line);
    } else {
      const first = document.querySelector(
        ".problem-row[data-jump-line], details.problem-tree-node:not(.is-filtered) summary[data-jump-line]",
      );
      if (first) {
        jumpTo(
          first.getAttribute("data-jump-file"),
          first.getAttribute("data-jump-line"),
        );
      }
    }
  });
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

  const phraseBtn = target.closest("[data-open-phrase]");
  if (phraseBtn) {
    const expr = phraseBtn.getAttribute("data-open-phrase");
    if (expr) openPhraseModal(expr, phraseBtn);
    return;
  }

  const unphrasedRow = target.closest("[data-unphrased]");
  if (unphrasedRow && !target.closest("button")) {
    const expr = unphrasedRow.getAttribute("data-unphrased");
    if (expr) openPhraseModal(expr, unphrasedRow);
    return;
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
