# Test Plan Visual Centering

Follow these rules when you center a number or label inside a badge, pill, or segmented button in [test-plan.css](../testing/test-plan.css). The patterns are in [test-plan-visual-centering.csv](test-plan-visual-centering.csv).

## What Centered Means

- Centered means the ink looks centered on both axes. Equal box centers do not prove it.
- People find the center of a shape from its contour. Type is spaced by ink, and round glyphs overshoot flat ones.
- A line box reserves descender room. Digits have no descender, so they sit low in a centered line box.

## Rules for Editing

1. Report the horizontal and vertical offsets together. A one-axis fix is incomplete.
2. Trim the text box to the cap height with `text-box: trim-both cap alphabetic`. Keep an `@supports not` fallback that uses block padding.
3. Make a circular pill with equal `min-inline-size` and `block-size` in rem, `border-radius: 999px`, and `justify-content: center`. Counts too wide for the circle stretch it into a pill.
4. Set any horizontal nudge through `--digit-shift`. Digit `0` is symmetric in Segoe UI bold, yet no shift read as too far left and `1px` as too far right. The current value is `0.5px`.
5. Do not repeat a value the user rejected. Two rejections bracket the answer, so try the midpoint.
6. Look up perception research when the user asks for it, and apply it to the measurement.

## How to Measure

- Read the rendered ink, not the box. Scan the pixels of a 1x screenshot crop of the pill and compute the dark-ink centroid inside the circle.
- Canvas `measureText` bounds are integer-rounded. Scan glyph pixels at 16x for glyph geometry.
- Inline `deno eval` can inflate a PNG with `DecompressionStream`. Its npm imports fail, and a `>>` in a Bash command trips the file-write hook.
- Preview the page through the `docs` server in `.claude/launch.json`. The Browser pane loads local files as `data:` documents, so relative links break.
- State what the pane cannot show. The user's display may rasterize text differently.
