# Design Tokens Preview

A visual preview tool for browsing and copying design tokens from your system.

## Features

- 🔍 **Search**: Find tokens by name, value, or description
- 📋 **Copy**: One-click copy of token values
- 🎨 **Color Preview**: Visual preview of color tokens
- 📊 **Organized by Type**: Tokens grouped by category (color, spacing, typography, etc.)
- 🔗 **Responsive**: Works on desktop and mobile devices

## Usage

### Local Development

1. Open `index.html` directly in your browser
2. The preview tool will automatically load tokens from the source files

### With Build Output

1. Build the tokens first:
   ```bash
   npm run build
   ```

2. Open `preview/index.html` in your browser
3. Tokens will be loaded from the `dist` folder

## How It Works

The preview tool:
1. Loads token files from `tokens/` or `dist/tokens/` directories
2. Flattens the hierarchical token structure
3. Displays tokens organized by category
4. Provides search and filtering capabilities
5. Allows copying individual token values to clipboard

## File Format

Tokens should be in the Design Tokens Format Module (DTCG) specification:

```json
{
  "color": {
    "primary": {
      "$value": "#3B82F6",
      "$type": "color",
      "$description": "Primary brand color"
    }
  }
}
```

## Customization

You can customize the preview by editing `index.html`:
- Change colors in the `<style>` section
- Modify the token loading paths in the `loadTokens()` method
- Add more token categories in `categories` array

CI note: When token changes are requested via the issue form, workflows may create branches and open PRs automatically. If Actions cannot create PRs due to repository or organization restrictions, add a repository secret named `ACTIONS_PAT` with a personal access token (recommended scope: `repo`). See `README.md` → "Publishing" and `.github/workflows/create-token.yaml` for details.
