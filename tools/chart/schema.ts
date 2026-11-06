// Validates the content of a missions/<name>.chart.json file against chart.schema.json.
import { Ajv } from "ajv";
import schema from "./chart.schema.json" with { type: "json" };

export class UnknownVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`unknown chart version: ${JSON.stringify(version)}`);
    this.name = "UnknownVersionError";
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export type ChartFile = {
  version: number;
  mission: string;
  traceBound: number;
  globals: { name: string; accessor: string; kind: "read" | "write" }[];
  marks: { statementText: string; label?: string }[];
  states: {
    label?: string;
    transitions: { guard: string; target: string }[];
  }[];
  launchSites: {
    file: string;
    line: number;
    thread: string;
    guardLines: number[];
  }[];
  conflicts: {
    pair: "mission-thread" | "thread-thread" | "trigger-mission";
    accesses: { file: string; line: number; kind: "read" | "write" }[];
  }[];
  traces: { effects: string }[];
};

export class ChartSchema {
  static readonly versions: readonly number[] = [1];
  #validate = new Ajv({ allErrors: true }).compile(schema);

  /** Returns the data typed as a chart file, or throws UnknownVersionError or SchemaError. */
  check(data: unknown): ChartFile {
    const version = typeof data === "object" && data !== null
      ? (data as { version?: unknown }).version
      : undefined;
    if (
      version !== undefined && !ChartSchema.versions.includes(version as number)
    ) {
      throw new UnknownVersionError(version);
    }
    if (!this.#validate(data)) {
      const lines = (this.#validate.errors ?? []).map((e) =>
        `${e.instancePath || "/"} ${e.message}`
      );
      throw new SchemaError(`chart file is invalid:\n${lines.join("\n")}`);
    }
    return data as ChartFile;
  }
}
