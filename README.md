# Design Tokens Playground

A minimal DTCG token pipeline with one end-to-end production spike across all layers:

- universal -> system -> semantic -> component
- one color chain
- one spacing chain

The repository is intentionally small so the build, validation, and workflow behavior are easy to reason about.

## Current Token Spike

### Color chain

1. `universal.color.blue`
2. `system.light.color.brand.primary` -> `{universal.color.blue}`
3. `semantic.color.interactive.primary` -> `{system.light.color.brand.primary}`
4. `component.button.primary.background` -> `{semantic.color.interactive.primary}`

### Spacing chain

1. `universal.spacing.16`
2. `system.spacing.component.button.padding-horizontal` -> `{universal.spacing.16}`
3. `semantic.spacing.component.button.padding` -> `{system.spacing.component.button.padding-horizontal}`
4. `component.button.primary.padding` -> `{semantic.spacing.component.button.padding}`

## Commands

```bash
npm install
npm run build
npm run preview
```

### Build variants

```bash
npm run build:css-only
npm run build:js-only
npm run build:types-only
npm run build:watch
npm run clean
```

### CLI flags

```bash
npm run build -- --prefix ds
npm run build -- --output-dir dist
npm run build -- --no-css
npm run build -- --no-js
npm run build -- --no-types
npm run build -- --no-json
npm run build -- --no-references
```

## Outputs

`npm run build` generates:

- `dist/css/variables.css`
- `dist/tokens.json`
- `dist/tokens.resolved.json`
- `dist/tokens.interpreted.json`
- `dist/tokens.js`
- `dist/tokens.d.ts`

## Project Structure

```text
tokens/
  universal/
    base.colors.tokens.json
    base.spacing.tokens.json
    base.typography.tokens.json
  system/
    theme.colors.tokens.json
    theme.spacing.tokens.json
  semantic/
    colors.tokens.json
    spacing.tokens.json
  component/
    base.tokens.json

src/
  index.ts
  build-config.ts
  build-tokens.ts
  token-loader.ts
  token-reference-resolver.ts
  token-validator.ts

.github/scripts/
  token-common.ts
  token-validator.ts
  create-token.ts
  update-token.ts
  delete-token.ts
```

## What This Repository Does

- Loads and merges `tokens/**/*.tokens.json`
- Validates DTCG structure and layer hierarchy
- Runs best-effort TokenScript interpretation
- Resolves token references for resolved JSON output
- Builds CSS, JS, and TypeScript outputs via Style Dictionary

## What This Repository Does Not Try To Do

- Ship a full production design system token catalog
- Maintain broad example token sets
- Hide implementation complexity with large docs

## Preview

Use:

```bash
npm run preview
```

This builds first, then serves `preview/index.html` and reads from `dist/tokens.resolved.json`.

## Automation

GitHub workflows in `.github/workflows/` support create, update, and delete token requests via issue templates and helper scripts under `.github/scripts/`.

