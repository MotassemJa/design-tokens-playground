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
- Clean: `npm run clean` (removes `dist/`).
- Preview: `npm run preview` — builds then serves via `http-server` on port 8000 and opens `/preview/index.html`.
- Publish: `npm run publish:npm` — builds then publishes to npm (used by workflows).

Notes: There are no dedicated `test` or `lint` scripts in package.json. If a user asks for running a single build output, use `npm run build -- --no-types --no-json` etc. (see README for flags).

---

## High-level architecture (big picture)

- tokens/ — canonical source JSON token files. Organized by category (color, spacing, semantic, component). Tokens follow the DTCG format and are the single source of truth.
- src/ — build pipeline and utilities:
  - `index.ts` — CLI / build entry that wires Style Dictionary and TokenScript processing.
  - `build-config.ts`, `build-tokens.ts` — build orchestration and configuration
  - `token-loader.ts`, `token-reference-resolver.ts` — token loading and reference resolution logic
- dist/ — generated artifacts consumed by consumers:
  - `dist/css/variables.css`, `dist/tokens.json`, `dist/tokens.resolved.json`, `dist/tokens.interpreted.json`, `dist/tokens.js`, `dist/tokens.d.ts`.
- preview/ — static interactive token browser (preview/index.html) used to inspect tokens locally or via GitHub Pages.
- .github/workflows/ — CI automation: issue-to-PR token workflows (create/update/delete), build & publish workflows; token-management scripts live under `.github/scripts/` and are used by workflows and maintainers.
- package.json exports and `bin` entry expose artifact entry-points (`./css`, `./tokens`, `./resolved`, `./interpreted`) and a `design-tokens` CLI (points to `dist/index.js`).

Runtime targets: Node.js 20+, npm 10+ (see README/DEVELOPMENT.md and tsconfig.json using `node20` module target).

---

## Key conventions and patterns (repo-specific)

- Token format: DTCG-style entries with required properties `"$value"` and `"$type"` (optionally `$description`, `$extensions`). Copilot should assume this format when suggesting token edits.
- Naming:
  - Token keys: kebab-case (e.g., `primary-blue`, `spacing-large`) and grouped via dot notation for resolved paths (e.g., `color.primary.500`).
  - Semantic tokens under `tokens/semantic/` use `semantic.{category}.{intent}.{variant}`.
  - Component tokens under `tokens/component/` follow `component.{component}.{variant}.{property}`.
- Token references: Use the `{path.to.token}` syntax to reference other tokens; the build pipeline resolves these into `tokens.resolved.json`.
- Outputs and variants: Building supports flags to omit outputs (e.g., `--no-types`, `--no-json`, `--no-js`, `--no-css`) — use these to create minimal builds.
- Validation: Token schema validation runs during build/pipeline and in `.github/scripts/token-validator.ts` — suggestions that modify tokens should keep `$type` values valid and `$value` formats consistent with `$type` (e.g., colors as hex/rgb/hsl, durations as `ms`/`s`).
- Preview: The `preview/index.html` is intended to be opened after build or directly for a local view; `npm run preview` serves it on port 8000.
- Exports: Consumers import tokens via package exports: `import tokens from 'design-tokens-playground/tokens'` or use `./css` for the generated CSS file.

---

## Files and places to check (quick pointers)

- Build entry: `src/index.ts`
- Token sources: `tokens/` (check category subfolders)
- Validation & scripts: `.github/scripts/` (create/update/delete token helpers)
- CI: `.github/workflows/` (issue workflows, build, publish)
- Preview: `preview/index.html` and `preview/README.md`

---

## Notes for Copilot sessions

- Prefer making changes in `tokens/` and then running the build pipeline instead of editing `dist/` directly.
- When suggesting edits to tokens, include the precise path (e.g., `tokens/color/base.tokens.json`) and preserve DTCG structure.
- Avoid adding tests or linters unless requested; repo currently has none.
- When generating code changes, prefer small surgical edits and run `npm run build` to validate outputs.

---

## Environment

- Node >=20, npm >=10
- TypeScript build targets Node 20 (see `tsconfig.json`).

---

(Referenced README.md and DEVELOPMENT.md for commands, architecture, and conventions.)

Note: CI workflows may create branches and PRs automatically. If your repository blocks Actions from creating or approving pull requests, maintainers should add a repository secret `ACTIONS_PAT` (Personal Access Token with `repo` scope or equivalent). See README.md → "Publishing" and `.github/workflows/create-token.yaml`.
