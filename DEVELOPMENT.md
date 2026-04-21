# Development Guide

This project is a compact reference implementation for a DTCG token build pipeline.

## Prerequisites

- Node.js 20+
- npm 10+

## Local Workflow

```bash
npm install
npm run build:watch
```

In another terminal:

```bash
npm run preview
```

Edit files in `tokens/`, refresh preview, and inspect generated artifacts in `dist/`.

## Build Flow

1. `src/token-loader.ts` loads `tokens/{universal,system,semantic,component}/tokens.json` (only that exact layout is accepted).
2. `src/token-validator.ts` validates Curtis Nathan naming + layer-reference rules. Value validation is delegated to TokenScript.
3. `src/build-tokens.ts` runs `@tokens-studio/tokenscript-interpreter` for interpretation and value validation.
4. `src/token-reference-resolver.ts` resolves references for resolved output.
5. `src/build-config.ts` defines Style Dictionary platforms.
6. Style Dictionary writes CSS/JS/types outputs.

## Token Layer Rules

- `universal.*` references nothing
- `system.*` references `universal.*`
- `semantic.*` references `system.*`
- `component.*` references `semantic.*`

Cross-layer violations fail validation.

## Token Files

Exactly one file per hierarchy, always named `tokens.json`:

- `tokens/universal/tokens.json`
- `tokens/system/tokens.json`
- `tokens/semantic/tokens.json`
- `tokens/component/tokens.json`

Any other filename or subdirectory is rejected by `TokenLoader.assertLayoutStrict()`.

## Token Naming (Curtis Nathan)

Paths are always `{namespace}.{object}.{base}.{modifier}` with all segments
in lowercase kebab-case. See README.md for full examples.

## Build Commands

```bash
npm run build
npm run build:css-only
npm run build:js-only
npm run build:types-only
npm run clean
npm test
```

`npm test` runs the Jest suite in `tests/*.test.ts` against fixtures in `tests/fixtures/`.

## Preview

`npm run preview` serves the static browser preview after building.

The preview reads `dist/tokens.resolved.json`.

## Scripted Token Management

`.github/scripts/` contains create/update/delete helpers used by workflows.

Core shared logic lives in `.github/scripts/token-common.ts`, which reuses `TokenValidator` from `src/token-validator.ts` — there is no separate validator inside `.github/scripts/`.

