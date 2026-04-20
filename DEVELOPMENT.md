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

1. `src/token-loader.ts` discovers and merges `tokens/**/*.tokens.json`.
2. `src/token-validator.ts` validates DTCG shape and hierarchy rules.
3. `src/build-tokens.ts` runs TokenScript best-effort processing.
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

- `tokens/universal/base.colors.tokens.json`
- `tokens/universal/base.spacing.tokens.json`
- `tokens/universal/base.typography.tokens.json`
- `tokens/system/theme.colors.tokens.json`
- `tokens/system/theme.spacing.tokens.json`
- `tokens/semantic/colors.tokens.json`
- `tokens/semantic/spacing.tokens.json`
- `tokens/component/base.tokens.json`

## Build Commands

```bash
npm run build
npm run build:css-only
npm run build:js-only
npm run build:types-only
npm run clean
```

## Preview

`npm run preview` serves the static browser preview after building.

The preview reads `dist/tokens.resolved.json`.

## Scripted Token Management

`.github/scripts/` contains create/update/delete helpers used by workflows.

Core shared logic lives in `.github/scripts/token-common.ts` and schema checks in `.github/scripts/token-validator.ts`.

