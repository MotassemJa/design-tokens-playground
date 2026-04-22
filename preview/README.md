# Preview

The preview is a static browser UI for inspecting built tokens.

## Run

```bash
npm run preview
```

This command builds tokens and serves `preview/index.html` on port `8000`.

## Data Source

The preview reads from:

- `dist/tokens.resolved.json`

If `dist/` is missing or stale, run `npm run build` first.

## Development Loop

1. Run `npm run build:watch`
2. Run `npm run preview`
3. Edit token files in `tokens/`
4. Refresh the preview page

## Scope

The current UI is used to browse a minimal 4-layer token spike, not a large catalog.

