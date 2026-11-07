import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { ChartServer } from "./server.ts";

const base = {
  version: 1,
  mission: "intro",
  globals: [],
  marks: [],
  states: [],
  launchSites: [],
  conflicts: [],
  traces: [],
};

async function fixture(): Promise<{ root: string; file: string }> {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(join(root, "missions"));
  await Deno.mkdir(join(root, "dist", "charts"), { recursive: true });
  const file = join(root, "missions", "intro.chart.json");
  await Deno.writeTextFile(file, JSON.stringify(base, null, 2));
  return { root, file };
}

function post(path: string, body: unknown): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readMarks(file: string) {
  return JSON.parse(await Deno.readTextFile(file)).marks;
}

Deno.test("adds, relabels, moves, and removes a mark", async () => {
  const { root, file } = await fixture();
  const server = new ChartServer(root);

  let response = await server.handle(post("/intro/marks", {
    action: "add",
    statementText: "Wait 0 ms",
    label: "Dump",
  }));
  assertEquals(response.status, 200);
  assertEquals(await readMarks(file), [{
    statementText: "Wait 0 ms",
    label: "Dump",
  }]);

  response = await server.handle(post("/intro/marks", {
    action: "add",
    statementText: "Wait 0 ms",
    label: "Relabeled",
  }));
  assertEquals(response.status, 200);
  assertEquals(await readMarks(file), [{
    statementText: "Wait 0 ms",
    label: "Relabeled",
  }]);

  response = await server.handle(post("/intro/marks", {
    action: "set",
    from: { statementText: "Wait 0 ms" },
    to: { statementText: "Set $X 1" },
  }));
  assertEquals(response.status, 200);
  assertEquals(await readMarks(file), [{
    statementText: "Set $X 1",
    label: "Relabeled",
  }]);

  response = await server.handle(post("/intro/marks", {
    action: "remove",
    statementText: "Set $X 1",
  }));
  assertEquals(response.status, 200);
  assertEquals(await readMarks(file), []);
});

Deno.test("rejects a mission outside 1 to 6 and writes nothing", async () => {
  const { root, file } = await fixture();
  const before = await Deno.readTextFile(file);
  const response = await new ChartServer(root).handle(post("/hell/marks", {
    action: "add",
    statementText: "Wait 0 ms",
  }));
  assertEquals(response.status, 404);
  assertStringIncludes(await response.text(), "hell");
  assertEquals(await Deno.readTextFile(file), before);
});

Deno.test("error messages name the action, the item, the reason, and the next step", async () => {
  const { root } = await fixture();
  const server = new ChartServer(root);

  const badMission = await server.handle(
    post("/hell/marks", { action: "add", statementText: "Wait 0 ms" }),
  );
  const badMissionText = await badMission.text();
  assertStringIncludes(badMissionText, 'Could not save marks for "hell"');
  assertStringIncludes(badMissionText, "intro");

  const missing = await server.handle(
    post("/intro/marks", { action: "remove", statementText: "Set $X 1" }),
  );
  const missingText = await missing.text();
  assertStringIncludes(
    missingText,
    'Could not remove the mark on "Set $X 1" in intro',
  );
  assertStringIncludes(missingText, "No mark sits on that statement");
  assertStringIncludes(missingText, "Reload the page");

  const unknownRoute = await server.handle(new Request("http://127.0.0.1/"));
  const unknownText = await unknownRoute.text();
  assertStringIncludes(unknownText, "Could not GET /");
  assertStringIncludes(unknownText, "GET /<mission>.html");
  assertStringIncludes(unknownText, "POST /<mission>/marks");
});

const hasRunPermission =
  Deno.permissions.querySync({ name: "run" }).state === "granted";

Deno.test({
  name: "regenerate names the mission and the failed step, and rejects other missions",
  ignore: !hasRunPermission,
  async fn() {
    const { root } = await fixture();
    const server = new ChartServer(root);

    const rejected = await server.handle(post("/hell/regenerate", {}));
    assertEquals(rejected.status, 404);
    assertStringIncludes(
      await rejected.text(),
      'Could not rebuild the chart for "hell"',
    );

    const failed = await server.handle(post("/intro/regenerate", {}));
    assertEquals(failed.status, 500);
    const failedText = await failed.text();
    assertStringIncludes(failedText, "Could not rebuild the chart for intro");
    assertStringIncludes(failedText, "exit code");
    assertStringIncludes(failedText, "Fix the source");
  },
});

Deno.test("writes through a temporary file and leaves none behind", async () => {
  const { root, file } = await fixture();
  await new ChartServer(root).handle(post("/intro/marks", {
    action: "add",
    statementText: "Wait 0 ms",
  }));
  const entries: string[] = [];
  for await (const entry of Deno.readDir(join(root, "missions"))) {
    entries.push(entry.name);
  }
  assertEquals(entries, ["intro.chart.json"]);
  assertEquals((await readMarks(file)).length, 1);
});

Deno.test("serves styled HTML index page when text/html is accepted", async () => {
  const { root } = await fixture();
  const server = new ChartServer(root);
  const response = await server.handle(
    new Request("http://127.0.0.1/", {
      headers: { accept: "text/html,application/xhtml+xml" },
    }),
  );
  assertEquals(response.status, 200);
  const text = await response.text();
  assertStringIncludes(text, "Mission Charts");
  assertStringIncludes(text, "Available Missions");
  assertStringIncludes(text, "mission-card");
  assertStringIncludes(text, 'href="/intro.html"');
});

Deno.test("GET /phrases/suggest returns a compromise suggestion for opposite and leaves active blank", async () => {
  const { root } = await fixture();
  const server = new ChartServer(root);
  const res = await server.handle(
    new Request("http://127.0.0.1/phrases/suggest?expression=$FLAG%20==%201"),
  );
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.expression, "$FLAG == 1");
  assertEquals(data.nominal, "$FLAG is set");
  assertEquals(data.opposite, "$FLAG is not set");
  assertEquals(data.active, "");
});

Deno.test("POST /phrases adds or edits a row in Phrasebook.csv", async () => {
  const { root } = await fixture();
  const phrasebookPath = join(root, "Phrasebook.csv");
  const server = new ChartServer(root, { phrasebook: phrasebookPath });

  const res1 = await server.handle(
    post("/phrases", {
      expression: "$TEST_VAR == 1",
      nominal: "test is set",
      opposite: "test is not set",
      active: "test triggers",
    }),
  );
  assertEquals(res1.status, 200);
  const content1 = await Deno.readTextFile(phrasebookPath);
  assertStringIncludes(
    content1,
    "$TEST_VAR == 1,test is set,test is not set,test triggers",
  );

  // Edit the existing row
  const res2 = await server.handle(
    post("/phrases", {
      expression: "$TEST_VAR == 1",
      nominal: "test is active",
      opposite: "test is inactive",
      active: "test starts",
    }),
  );
  assertEquals(res2.status, 200);
  const content2 = await Deno.readTextFile(phrasebookPath);
  assertStringIncludes(
    content2,
    "$TEST_VAR == 1,test is active,test is inactive,test starts",
  );
});

Deno.test({
  name: "POST /<mission>/regenerate executes main.ts and returns orphans on success",
  ignore: !hasRunPermission,
  async fn() {
    const server = new ChartServer(Deno.cwd());
    const res = await server.handle(post("/intro/regenerate", {}));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.ok, true);
    assertEquals(Array.isArray(data.orphans), true);
  },
});

Deno.test("renders HTML dynamically in-memory without reading dist/charts/*.html", async () => {
  const { root } = await fixture();
  const distHtml = join(root, "dist", "charts", "intro.html");
  try {
    await Deno.remove(distHtml);
  } catch {
    // Expected to not exist
  }

  const mockAssembler = {
    async statements(mission: string) {
      assertEquals(mission, "intro");
      return [
        { line: 1, text: "Wait 0 ms", occurrence: 1, copies: 1, file: "main.txt" },
        { line: 2, text: "Set $X 1", occurrence: 1, copies: 1, file: "main.txt" },
      ];
    },
  };

  const server = new ChartServer(root, { assembler: mockAssembler });
  const response = await server.handle(
    new Request("http://127.0.0.1:8080/intro.html"),
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  const html = await response.text();
  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, "Intro Chart");
  assertStringIncludes(html, "Wait 0 ms");

  let distExists = true;
  try {
    await Deno.stat(distHtml);
  } catch {
    distExists = false;
  }
  assertEquals(distExists, false);
});

Deno.test("POST /<mission>/marks updates .chart.json directly without subprocess rebuild", async () => {
  const { root, file } = await fixture();
  const server = new ChartServer(root);

  const response = await server.handle(post("/intro/marks", {
    action: "add",
    statementText: "Wait 0 ms",
    label: "Dynamic Mark",
  }));
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.ok, true);
  assertEquals(data.marks, [{
    statementText: "Wait 0 ms",
    label: "Dynamic Mark",
  }]);

  const updatedChart = JSON.parse(await Deno.readTextFile(file));
  assertEquals(updatedChart.marks, [{
    statementText: "Wait 0 ms",
    label: "Dynamic Mark",
  }]);
});

Deno.test("chart:serve task configuration includes --env-file=.env and restricts network access to 127.0.0.1", async () => {
  const denoConfig = JSON.parse(await Deno.readTextFile("deno.json"));
  const taskCmd = denoConfig.tasks["chart:serve"];
  assertStringIncludes(taskCmd, "--env-file=.env");
  assertStringIncludes(taskCmd, "--allow-net=127.0.0.1");
});
