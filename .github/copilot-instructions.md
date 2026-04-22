# Copilot instructions for design-tokens-playground

Purpose: Help future Copilot sessions understand how to build, run, and reason about this repository quickly.

---

## Build, test, and lint (concrete commands)

- Primary build: `npm run build` — builds tokens and outputs to `dist/` (CSS, JSON, JS, d.ts).
- Build variants:
  - `npm run build:css-only` — only CSS output
  - `npm run build:js-only` — only JS output
  - `npm run build:types-only` — only type declarations
  - `npm run build:watch` — watch mode via `tsx` for iterative development
- Test: `npm test` — runs the Jest suite in `tests/*.test.ts`; `npm run test:watch` for watch mode.
- Clean: `npm run clean` (removes `dist/`).
- Preview: `npm run preview` — builds then serves via `http-server` on port 8000 and opens `/preview/index.html`.
- Publish: `npm run publish:npm` — builds then publishes to npm (used by workflows).

Notes: There is no dedicated lint script. For a minimal build omitting specific outputs, use flags such as `npm run build -- --no-types --no-json` (see README for all flags).

---

## High-level architecture (big picture)

- tokens/ — canonical source JSON token files. Organized by hierarchy layer (design-values, universal, system, semantic, component). Tokens follow the DTCG format and are the single source of truth. Each layer lives in `tokens/{layer}/tokens.json`.
- src/ — build pipeline and utilities:
  - `index.ts` — CLI / build entry that parses flags and drives the build pipeline.
  - `build-config.ts` — Style Dictionary platform configuration and `BuildOptions` interface.
  - `build-tokens.ts` — end-to-end build orchestration (load → validate → interpret → Style Dictionary → JSON output).
  - `token-loader.ts` — loads and merges `tokens/{hierarchy}/tokens.json`; enforces strict directory layout.
  - `token-reference-resolver.ts` — resolves `{path.to.token}` references for the resolved JSON artifact.
  - `token-validator.ts` — enforces Curtis Nathan naming convention and 4-layer hierarchy reference rules.
- dist/ — generated artifacts consumed by downstream packages:
  - `dist/css/variables.css`, `dist/tokens.json`, `dist/tokens.resolved.json`, `dist/tokens.interpreted.json`, `dist/tokens.js`, `dist/tokens.d.ts`.
- preview/ — static interactive token browser (preview/index.html) used to inspect tokens locally or via GitHub Pages.
- tests/ — Jest test suite covering token loading, validation, and pipeline behaviour; fixtures in `tests/fixtures/`.
- .github/workflows/ — CI automation: issue-to-PR token workflows (create/update/delete), build & publish workflows; token-management scripts live under `.github/scripts/` and are used by workflows and maintainers.
- package.json exports and `bin` entry expose artifact entry-points (`./css`, `./tokens`, `./resolved`, `./interpreted`) and a `design-tokens` CLI (points to `dist/index.js`).

Runtime targets: Node.js 20+, npm 10+ (see README/DEVELOPMENT.md and tsconfig.json using `node20` module target).

---

## Key conventions and patterns (repo-specific)

- Token format: DTCG-style entries with required properties `"$value"` and `"$type"` (optionally `$description`, `$extensions`). Copilot should assume this format when suggesting token edits.
- Token hierarchy: Exactly five layers — `design-values`, `universal`, `system`, `semantic`, `component`. Each layer lives in `tokens/{layer}/tokens.json`. No other directories or filenames are accepted.
- Naming convention (Curtis Nathan): All token path segments are **lowercase kebab-case**. Path structure is `{namespace}.{object}.{base}.{modifier}` where the groups map to:
  - `namespace` = `system.theme.domain` (encodes the layer context, e.g. `system.light.color`)
  - `object` = `group.component.element` (e.g. `button.primary.text`)
  - `base` = `category.concept.property` (e.g. `color` or `space.padding`)
  - `modifier` = `variant.state.scale.mode` (e.g. `hover.on-light`)
  - `design-values.*` references nothing (raw primitives).
  - `universal.*` may only reference `design-values.*`.
  - `system.*` may reference `design-values.*` or `universal.*`.
  - `semantic.*` may reference `design-values.*`, `universal.*`, or `system.*`.
  - `component.*` may reference `design-values.*`, `universal.*`, `system.*`, or `semantic.*`.
- Token references: Use the `{path.to.token}` syntax to reference other tokens; the build pipeline resolves these into `tokens.resolved.json`.
- Validation: Curtis Nathan naming and layer-reference rules are enforced by `src/token-validator.ts` at build time and by the Jest suite. Suggestions that modify tokens should keep `$type` values valid and `$value` formats consistent with `$type` (e.g. colors as hex/rgb/hsl).
- Outputs and variants: Building supports flags to omit outputs (e.g. `--no-types`, `--no-json`, `--no-js`, `--no-css`) — use these to create minimal builds.
- Preview: The `preview/index.html` is intended to be opened after build or directly for a local view; `npm run preview` serves it on port 8000.
- Exports: Consumers import tokens via package exports: `import tokens from 'design-tokens-playground/tokens'` or use `./css` for the generated CSS file.

---

## Files and places to check (quick pointers)

- Build entry: `src/index.ts`
- Token sources: `tokens/` (four subdirectories: `universal/`, `system/`, `semantic/`, `component/`)
- Validation: `src/token-validator.ts` (used by build pipeline and `.github/scripts/token-common.ts`)
- Scripts: `.github/scripts/` (create/update/delete token helpers, shared logic in `token-common.ts`)
- CI: `.github/workflows/` (issue workflows, build, publish)
- Preview: `preview/index.html` and `preview/README.md`

---

## Notes for Copilot sessions

- Prefer making changes in `tokens/` and then running the build pipeline instead of editing `dist/` directly.
- When suggesting edits to tokens, include the precise path (e.g., `tokens/system/tokens.json`) and preserve DTCG structure.
- Run `npm test` after token or source changes to verify validation rules pass.
- When generating code changes, prefer small surgical edits and run `npm run build` to validate outputs.

---

## Environment

- Node >=20, npm >=10
- TypeScript build targets Node 20 (see `tsconfig.json`).

---

(Referenced README.md and DEVELOPMENT.md for commands, architecture, and conventions.)
