(function () {
  var progressHeader = document.getElementById("test-progress");
  var progress = document.getElementById("completion-progress");
  var completionCount = document.getElementById("completion-count");
  var passedCount = document.getElementById("passed-count");
  var failedCount = document.getElementById("failed-count");
  var passedPill = document.getElementById("passed-pill");
  var failedPill = document.getElementById("failed-pill");
  var summary = document.getElementById("completion-summary");
  var storageStatus = document.getElementById("storage-status");
  var cases = document.querySelectorAll(".test-case");
  var storageKey = "test-plan:" + location.pathname;

  function updateStickyOffset() {
    var height = progressHeader.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--test-progress-block-size", height + "px");
  }

  function renderProgress() {
    var passed = 0;
    var failed = 0;
    cases.forEach(function (section) {
      var result = section.querySelector('.result-controls input[type="radio"]:checked');
      if (result && result.value === "passed") passed++;
      if (result && result.value === "failed") failed++;
    });
    var recorded = passed + failed;
    progress.max = cases.length;
    progress.value = recorded;
    completionCount.textContent = recorded + " of " + cases.length;
    passedCount.textContent = passed;
    failedCount.textContent = failed;
    passedPill.title = passed + " passed";
    passedPill.setAttribute("aria-label", passed + " test cases have passed");
    failedPill.title = failed + " failed";
    failedPill.setAttribute("aria-label", failed + " test cases have failed");
    summary.textContent = recorded + " of " + cases.length + " cases recorded: " + passed + " passed, " + failed + " failed.";
  }

  function writeState() {
    var state = { steps: {}, results: {} };
    cases.forEach(function (section) {
      section.querySelectorAll('.steps input[type="checkbox"]').forEach(function (box, i) {
        state.steps[section.id + "/" + i] = box.checked;
      });
      var result = section.querySelector('.result-controls input[type="radio"]:checked');
      state.results[section.id] = result ? result.value : null;
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      storageStatus.hidden = true;
    } catch (e) {
      storageStatus.textContent = "Local storage is unavailable. Results will last only until this page closes.";
      storageStatus.hidden = false;
    }
  }

  function restoreState() {
    var state = {};
    try { state = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) { /* storage unavailable */ }
    cases.forEach(function (section) {
      section.querySelectorAll('.steps input[type="checkbox"]').forEach(function (box, i) {
        box.checked = !!(state.steps && state.steps[section.id + "/" + i]);
      });
      var result = state.results && state.results[section.id];
      var radio = result && section.querySelector('.result-controls input[value="' + result + '"]');
      if (radio) radio.checked = true;
    });
  }

  function syncCase(section) {
    var boxes = section.querySelectorAll('.steps input[type="checkbox"]');
    var done = Array.prototype.every.call(boxes, function (box) { return box.checked; });
    var result = section.querySelector('.result-controls input[type="radio"]:checked');
    var recorded = result !== null && result.value !== "not-run";
    section.querySelector(".test-case-details").open = !(done && recorded);
  }

  cases.forEach(function (section) {
    var boxes = section.querySelectorAll('.steps input[type="checkbox"]');
    var passedRadio = section.querySelector('input[value="passed"]');
    section.querySelectorAll('.steps input[type="checkbox"], .result-controls input[type="radio"]').forEach(function (input) {
      input.addEventListener("change", function () { syncCase(section); writeState(); renderProgress(); });
    });
    boxes.forEach(function (box) {
      box.addEventListener("change", function () {
        var allChecked = Array.prototype.every.call(boxes, function (b) { return b.checked; });
        if (allChecked && !passedRadio.checked) {
          passedRadio.checked = true;
          passedRadio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });
  });

  document.querySelectorAll('.result-controls input[value="passed"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (window.eventideConfetti) window.eventideConfetti(radio);
    });
  });

  updateStickyOffset();
  if ("ResizeObserver" in window) {
    new ResizeObserver(updateStickyOffset).observe(progressHeader);
  }
  window.addEventListener("resize", updateStickyOffset);

  restoreState();
  renderProgress();
  cases.forEach(function (section) { syncCase(section); });
})();
