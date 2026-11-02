# Test Plans

- A test plan is for humans. Every case is something a person does and sees in the game or on a page. Keep commands, file hashes and sizes, exit codes, and output comparisons out of the plan. The agent runs those checks itself, through tests or scripts, and reports the results in chat.
- A test plan stands alone. Never refer to the agent, to chat, or to anything outside the page, because a human may read only the plan. Each case starts with the exact command that prepares its build, unless an earlier case in the same plan already installed that build; then it starts from the game menu. Each case then says what to do in the game, and then says what the player sees.
- Do not write a plan that has no human case.
- Test plan pages link the shared [test-plan.css](test-plan.css), [confetti.js](confetti.js), and [test-plan.js](test-plan.js). The script drives the progress bar, saves results in the viewer's browser, and marks a case Passed when every step in it is checked. Colors come from [docs/palette.csv](../../docs/palette.csv) through the stylesheet's custom properties.
- Preview a test plan through the `docs` server in `.claude/launch.json`. The Browser pane loads local files as `data:` documents, so relative links break.
- A finished test case (Passed or Failed) collapses only its steps. The Expected result stays visible in a `fieldset.expected` group box whose `legend` sits on the border.
- Test case internals use one flex `gap` in `.test-case` and no margins. Measure the visible-edge gaps in the running page after you add an element.
- Read [test-plan-visual-centering.md](../lessons/test-plan-visual-centering.md) before you center a number or label in a pill or button.
