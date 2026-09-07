# Agent rules

Immediately read the unslop skill at the start of every session and apply it to ALL text you generate.
Use function-design and minimal-increment skills pre-emptively *before* working with any code.

## Minimal implementation

Only implement the smallest version explicitly requested. Do not add anticipated features, polish, labels, helper text, explanatory copy, or other UI text unless explicitly requested. Prefer a simple implementation that can be extended incrementally.

## Context-appropriate wording

Map the intended message to phrasing that fits the artifact's domain and audience. Verify that the final phrasing makes sense to that audience in its own context.

Treat the prompt as working context, not automatic output. Include prompt wording, comparisons, examples, or process constraints only when the user explicitly requests them or the artifact's audience needs them.

Examples:

- In a README or UI, describe the product or feature directly. Do not name a product mentioned only as shorthand for the requested behaviour.
- In a code comment, explain the code's non-obvious purpose or behaviour, not an instruction given to the agent.
- In a commit message, state the change made, not that it was requested.
