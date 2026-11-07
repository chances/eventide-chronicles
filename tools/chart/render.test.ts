import { assertEquals, assertStringIncludes } from "@std/assert";
import { PageRenderer } from "./render.ts";
import type { ChartFile } from "./schema.ts";
import type { Statement } from "./marks.ts";

Deno.test("PageRenderer renders navigation attributes on statements, problems, and globals", () => {
  const chart: ChartFile = {
    version: 1,
    mission: "intro",
    globals: [
      { name: "$Admiral", accessor: "Intro", kind: "write" },
      { name: "$Admiral", accessor: "Police", kind: "read" },
    ],
    marks: [],
    states: [],
    launchSites: [],
    conflicts: [
      {
        pair: "mission-thread",
        global: "$Admiral",
        accesses: [
          {
            script: "intro",
            file: "missions/intro.txt",
            line: 2,
            kind: "write",
          },
          { script: "Police", file: "main.txt", line: 10, kind: "read" },
        ],
      },
    ],
    errors: [
      {
        kind: "reach",
        file: "missions/intro.txt",
        line: 1,
        severity: "error",
        states: ["State 1", "State 2"],
      },
    ],
    traces: [],
  };

  const statements: Statement[] = [
    {
      file: "missions/intro.txt",
      line: 1,
      text: "Wait 0 ms",
      occurrence: 1,
      copies: 1,
    },
    {
      file: "missions/intro.txt",
      line: 2,
      text: "Set $Admiral 1",
      occurrence: 1,
      copies: 1,
    },
  ];

  const renderer = new PageRenderer(chart, statements, (file) => {
    if (file === "missions/intro.txt") {
      return "Wait 0 ms\nSet $Admiral 1";
    }
    return "";
  });

  const html = renderer.render();

  // Header problem chips carry data-nav-problem
  assertStringIncludes(html, 'data-nav-problem="error"');
  assertStringIncludes(html, 'data-nav-problem="warning"');

  // Globals tree node carries data-nav-global
  assertStringIncludes(html, 'data-nav-global="$Admiral"');

  // Problems panel carries data-nav-problem for reach error and conflict
  assertStringIncludes(html, 'data-nav-problem="reach:1"');
  assertStringIncludes(html, 'data-nav-problem="conflict:$Admiral"');

  // Statement rows carry data-statement-index, data-statement-text, data-globals, and data-problem
  assertStringIncludes(html, 'data-statement-index="0"');
  assertStringIncludes(html, 'data-statement-text="Wait 0 ms"');
  assertStringIncludes(html, 'data-problem="reach:1 error"');

  assertStringIncludes(html, 'data-statement-index="1"');
  assertStringIncludes(html, 'data-statement-text="Set $Admiral 1"');
  assertStringIncludes(html, 'data-globals="$Admiral"');
  assertStringIncludes(html, 'data-problem="conflict:$Admiral warning"');
});

Deno.test("PageRenderer renders .phrase-badge and phrase popover container", () => {
  const chart: ChartFile = {
    version: 1,
    mission: "intro",
    globals: [],
    marks: [],
    states: [
      {
        label: "Start",
        transitions: [{ guard: "When not $ok == 1", target: "End" }],
      },
    ],
    launchSites: [
      {
        file: "main.txt",
        line: 12,
        thread: "Launcher",
        guardLines: [10],
      },
    ],
    conflicts: [],
    errors: [
      {
        kind: "unphrased",
        severity: "error",
        expression: "$ok == 1",
      },
    ],
    traces: [],
  };

  const statements: Statement[] = [
    {
      file: "main.txt",
      line: 10,
      text: "if $ok == 1",
      occurrence: 1,
      copies: 1,
    },
    {
      file: "main.txt",
      line: 12,
      text: "start_mission 1",
      occurrence: 1,
      copies: 1,
    },
  ];

  const renderer = new PageRenderer(chart, statements, (file) => {
    if (file === "main.txt") {
      return "...\n...\n...\n...\n...\n...\n...\n...\n...\nif $ok == 1\ngoto @fail\nstart_mission 1\n";
    }
    return "";
  });

  const html = renderer.render();

  // Launch site guard has phrase-badge with data-expression
  assertStringIncludes(html, 'class="launch-badge guard phrase-badge"');
  assertStringIncludes(html, 'data-expression="$ok == 1"');

  // Problem row carries phrase-badge
  assertStringIncludes(html, 'class="phrase-badge"');
  assertStringIncludes(html, 'data-open-phrase="$ok == 1"');

  // State transitions carry phrase-badge
  assertStringIncludes(html, 'data-phrase="When not $ok == 1"');

  // Script view statement row unphrased badge
  assertStringIncludes(html, 'class="phrase-badge unphrased-chip"');

  // Popover markup is rendered
  assertStringIncludes(html, 'id="phrase-popover"');
  assertStringIncludes(html, 'id="phrase-popover-save"');
});

Deno.test("PageRenderer renders trace switcher, rails container, scrubber, and branch template", () => {
  const chart: ChartFile = {
    version: 1,
    mission: "intro",
    globals: [],
    marks: [],
    states: [],
    launchSites: [],
    conflicts: [],
    errors: [],
    traces: [
      {
        script: "Intro",
        lock: "held",
        bound: 10,
        effects: ["wait 0", "create_threat_search 1", "mission_passed"],
      },
      {
        script: "Police",
        lock: "free",
        bound: 10,
        cut: true,
        effects: ["wait 0", "fail"],
      },
    ],
  };

  const statements: Statement[] = [
    {
      file: "missions/intro.txt",
      line: 1,
      text: "wait 0",
      occurrence: 1,
      copies: 1,
    },
    {
      file: "missions/intro.txt",
      line: 2,
      text: "create_threat_search 1",
      occurrence: 1,
      copies: 1,
    },
    {
      file: "missions/intro.txt",
      line: 3,
      text: "mission_passed",
      occurrence: 1,
      copies: 1,
    },
  ];

  const renderer = new PageRenderer(chart, statements, (file) => {
    if (file === "missions/intro.txt") {
      return "wait 0\ncreate_threat_search 1\nmission_passed\n";
    }
    return "";
  });

  const html = renderer.render();

  // Sidebar Traces tab is removed
  assertEquals(html.includes('data-inspector-tab="traces"'), false);

  // Compact Trace Switcher is present in editor toolbar
  assertStringIncludes(html, 'class="trace-switcher"');
  assertStringIncludes(html, 'id="trace-select"');
  assertStringIncludes(html, "Trace #1: Intro [PASS] (3 steps)");
  assertStringIncludes(html, "Trace #2: Police [LOOP] (2 steps)");

  // Gutter rails container and SVG are present in code view
  assertStringIncludes(html, 'class="trace-gutter-rails-container"');
  assertStringIncludes(html, 'class="trace-gutter-rails"');

  // Floating scrubber is present with controls and step counter
  assertStringIncludes(html, 'id="trace-scrubber"');
  assertStringIncludes(html, 'id="trace-scrubber-step"');
  assertStringIncludes(html, 'id="trace-prev"');
  assertStringIncludes(html, 'id="trace-next"');
  assertStringIncludes(html, 'id="trace-close"');

  // Branch card template is present
  assertStringIncludes(html, 'id="trace-branch-card-template"');
  assertStringIncludes(html, 'class="trace-branch-card"');

  // Traces JSON data is embedded for client script
  assertStringIncludes(html, 'id="chart-traces-data"');
  assertStringIncludes(html, '"Intro"');
});
