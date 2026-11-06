/**
 * @module
 * Keeps the authored marks of a chart while the derived content is rewritten.
 * A mark anchors to a statement by the statement's text with whitespace collapsed, and by its
 * 1-based occurrence among statements with the same text; an absent occurrence means the first.
 */
import type { ChartFile } from "./schema.ts";

export type Mark = ChartFile["marks"][number];
export type DerivedContent = Omit<ChartFile, "marks">;

export type RawStatement = { text: string; file: string; line: number };

/** A statement a mark can sit on; `occurrence` counts from 1 among `copies` statements with the same text. */
export type Statement = RawStatement & { occurrence: number; copies: number };

export type MarkKey = { statementText: string; occurrence?: number };

export type MergeResult = {
  chart: ChartFile;
  /** The statement each mark in `chart.marks` sits on now, or null when the mark is orphaned. */
  anchors: (Statement | null)[];
  orphans: Mark[];
};

/** Collapses every run of whitespace to one space. */
export const collapse = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const keyOf = (mark: MarkKey): string =>
  `${collapse(mark.statementText)}\0${mark.occurrence ?? 1}`;

export class MarksMerger {
  /** Numbers statements with the same collapsed text in order of appearance. */
  static number(raw: RawStatement[]): Statement[] {
    const total = new Map<string, number>();
    for (const s of raw) {
      const text = collapse(s.text);
      total.set(text, (total.get(text) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return raw.map((s) => {
      const text = collapse(s.text);
      const occurrence = (seen.get(text) ?? 0) + 1;
      seen.set(text, occurrence);
      return { ...s, text, occurrence, copies: total.get(text)! };
    });
  }

  /**
   * Takes the derived content as given and the marks from `existing`, unchanged except that a
   * mark with no statement is flagged `orphaned` and a mark whose statement is back loses the flag.
   */
  merge(
    existing: ChartFile | undefined,
    derived: DerivedContent,
    statements: Statement[],
  ): MergeResult {
    const byKey = new Map<string, Statement>();
    for (const s of statements) {
      byKey.set(
        keyOf({
          statementText: s.text,
          occurrence: s.occurrence,
        }),
        s,
      );
    }
    const anchors: (Statement | null)[] = [];
    const orphans: Mark[] = [];
    const marks = (existing?.marks ?? []).map((mark) => {
      const { orphaned: _was, ...rest } = mark;
      const anchor = byKey.get(keyOf(mark)) ?? null;
      anchors.push(anchor);
      if (anchor) return rest;
      const flagged = { ...rest, orphaned: true };
      orphans.push(flagged);
      return flagged;
    });
    return { chart: { ...derived, marks }, anchors, orphans };
  }

  /** Returns the chart without the mark at `key`, and throws when no mark sits there. */
  remove(chart: ChartFile, key: MarkKey): ChartFile {
    const target = keyOf(key);
    const marks = chart.marks.filter((m) => keyOf(m) !== target);
    if (marks.length === chart.marks.length) {
      throw new Error(`no mark at ${JSON.stringify(key.statementText)}`);
    }
    return { ...chart, marks };
  }
}
