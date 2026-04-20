# Design Tokens Playground

A comprehensive design tokens system built with Style Dictionary, featuring advanced token processing with TokenScript integration, automated GitHub workflows, and a web-based preview tool.

## Features

### 🎨 Token Management
- **GitHub Issue Integration**: Create, update, and delete tokens via GitHub Issues with automatic PR generation
- **Schema Validation**: Full DTCG (Design Tokens Community Group) format validation
- **Token References**: Automatic resolution of token references using `{path.to.token}` syntax
- **Type Safety**: Structured token values with proper TypeScript definitions

### 🚀 Advanced Processing
- **TokenScript Integration**: Domain-specific language for complex token computations and transformations
- **CSS Function Support**: Full support for `clamp()`, `calc()`, `minmax()`, and other CSS functions
- **Mathematical Operations**: Arithmetic operations, unit conversions, and responsive calculations
- **Color Manipulation**: Color space conversions, dynamic calculations, and alpha operations

### 📦 Multiple Output Formats
- **CSS Variables**: Ready-to-use CSS custom properties
- **JavaScript ESM**: Tree-shakable ES modules for modern bundlers
- **TypeScript Definitions**: Full type safety for TypeScript projects
- **JSON Exports**: Raw, resolved, and interpreted token formats

### 🔧 Developer Tools
- **Interactive Preview**: Web-based token browser with search and filtering
- **CLI Build System**: Flexible command-line interface with multiple build options
- **Automated Publishing**: GitHub Actions workflows for NPM publishing
- **Token Validation**: Real-time validation with detailed error reporting

### 📋 Token Categories
- **Base Tokens**: Primitive values (colors, spacing, typography)
- **Semantic Tokens**: Intent-based naming (brand colors, feedback states)
- **Component Tokens**: Composed styles for specific UI components

## Quick Start

### Installation
```bash
npm install @your-org/design-tokens
```

### Usage

#### CSS Variables
```html
<link rel="stylesheet" href="node_modules/@your-org/design-tokens/dist/css/variables.css">

<div style="color: var(--ds-color-primary);">Hello World</div>
```

#### JavaScript/TypeScript
```javascript
import { colors, spacing } from '@your-org/design-tokens';

const styles = {
  backgroundColor: colors.primary,
  padding: spacing.md,
};
```

#### JSON Import
```javascript
import tokens from '@your-org/design-tokens/tokens';

console.log(tokens.color.primary.bright_cyan.$value);
```

## TokenScript Examples

TokenScript enables advanced token computations:

```json
{
  "spacing": {
    "fluid": {
      "$value": "clamp(1rem, 2vw, 2rem)",
      "$type": "spacing",
      "$description": "Responsive spacing using CSS clamp"
    },
    "large": {
      "$value": "{spacing.base} * 2",
      "$type": "spacing",
      "$description": "Double the base spacing"
    }
  }
}
```

## Project Structure

```
├── tokens/                           # Source token files
│   ├── color/base.tokens.json       # Base color tokens
│   ├── spacing/base.tokens.json     # Spacing tokens
│   ├── semantic/colors.tokens.json  # Semantic color tokens
│   └── component/base.tokens.json   # Component tokens
│
├── src/
│   ├── index.ts                     # Build configuration & CLI
│   └── tokens.ts                    # Token exports (generated)
│
├── preview/
│   ├── index.html                   # Interactive token preview
│   └── README.md                    # Preview documentation
│
├── .github/
│   ├── workflows/                   # GitHub Actions automation
│   │   ├── create-token.yaml       # Token creation workflow
│   │   ├── update-token.yaml       # Token update workflow
│   │   ├── delete-token.yaml       # Token deletion workflow
│   │   ├── build-tokens.yaml       # Build & test workflow
│   │   └── publish-npm.yaml        # NPM publishing workflow
│   │
│   ├── scripts/                     # Token management scripts
│   │   ├── token-common.ts         # Shared utilities
│   │   ├── token-validator.ts      # Schema validation
│   │   ├── create-token.ts         # Create token CLI
│   │   ├── update-token.ts         # Update token CLI
│   │   └── delete-token.ts         # Delete token CLI
│   │
│   └── ISSUE_TEMPLATE/              # GitHub issue templates
│       ├── create-token.yaml
│       ├── update-token.yaml
│       └── delete-token.yaml
│
├── dist/                            # Build output (generated)
│   ├── css/variables.css            # CSS variables
│   ├── tokens.json                  # Raw tokens
│   ├── tokens.resolved.json         # Resolved references
│   ├── tokens.interpreted.json      # TokenScript processed
│   ├── tokens.js                    # JavaScript module
│   └── tokens.d.ts                  # TypeScript definitions
│
└── package.json                     # NPM package configuration
```

## Development

### Prerequisites
- Node.js 20+
- npm 10+
- Git

### Setup
```bash
git clone <repository>
cd design-tokens-playground
npm install
```

### Building Tokens
```bash
npm run build
```

### Preview Tokens
```bash
npm run preview
```
Opens an interactive web interface at `http://localhost:8000/preview/index.html`

This preview is also published automatically to GitHub Pages from the `main` branch.
After a successful build, access the live preview at:

`https://<your-github-username>.github.io/<your-repo>/`

### Build Options
```bash
# Build with custom prefix
npm run build -- --prefix myapp

# Build specific outputs only
npm run build -- --no-types --no-json

# Custom output directory
npm run build -- --output-dir build
```

## Token Format

All tokens follow the DTCG Design Tokens Format Module:

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

### Supported Token Types
- `color`: Hex, RGB, HSL, and color names
- `dimension`: Spacing, sizing with units (px, rem, em, %)
- `fontFamily`, `fontSize`, `fontWeight`, etc.: Typography
- `duration`: Time values (ms, s)
- `opacity`, `border`, `shadow`: Effects
- `typography`: Complete text style objects

## Managing Tokens

### Via GitHub Issues (Recommended)
1. **Create Token**: Use "🎨 Create New Token" issue template
2. **Update Token**: Use "✏️ Update Existing Token" issue template
3. **Delete Token**: Use "🗑️ Delete Token" issue template

### Manual Token Editing
Edit JSON files in the `tokens/` directory following the DTCG format.

### Validation
All tokens are automatically validated:
- Required `$value` and `$type` properties
- Type-specific value format validation
- Reference resolution
- Schema compliance

## Publishing

### Automated Build & Artifacts
The repository automatically builds and publishes artifacts on every `main` branch push:

- **GitHub Pages**: Live preview at `https://phhbr.github.io/design-tokens-playground/`
- **Downloadable Artifacts**: Built tokens available for download from GitHub Actions
- **Build Summary**: Detailed statistics and file information in the Actions logs

### Manual Publishing (Optional)

Note on CI permissions: The automated token workflows under `.github/workflows/` may create branches and open pull requests. If your repository or organization restricts GitHub Actions from creating or approving pull requests, create a repository secret named `ACTIONS_PAT` containing a Personal Access Token (recommended scopes: `repo` — or at minimum `contents`, `pull_requests`, `issues`). The workflows use `ACTIONS_PAT` as a fallback when `GITHUB_TOKEN` lacks permissions. See `.github/workflows/create-token.yaml` and `.github/scripts/create-token.ts` for details.

For NPM publishing, create a GitHub Release which triggers the `publish-npm.yaml` workflow.

## Token Naming Conventions

- **kebab-case** for token names: `primary-blue`, `spacing-large`
- **Dot notation** for grouping: `brand.primary.500`, `feedback.error`
- **Semantic tokens**: `semantic.{category}.{intent}.{variant}`
- **Component tokens**: `component.{component}.{variant}.{property}`

## Troubleshooting

### Build Fails with Validation Errors
```
❌ Token validation failed:
  - Token at path 'color.invalid': invalid color value
```
**Fix**: Use valid color formats like `#000000` or `rgb(0, 0, 0)`

### Token References Not Resolving
```json
{
  "color": {
    "primary": {
      "$value": "{color.undefined}",  // ❌ Reference doesn't exist
      "$type": "color"
    }
  }
}
```
**Fix**: Use exact paths to existing tokens. Check `tokens/` directory.

### CSS Variables Not Generated
```bash
npm run build
ls -la dist/css/
```
**Fix**: Check `src/index.ts` configuration if files are missing.

## Contributing

1. **Token Changes**: Use GitHub Issues for all token modifications
2. **Code Changes**: Submit PRs with proper testing
3. **Documentation**: Update README for new features

## Resources

- [DTCG Design Tokens Format Module](https://tr.w3.org/design-tokens/)
- [Style Dictionary Documentation](https://styledictionary.com/)
- [TokenScript Documentation](https://github.com/tokens-studio/tokenscript-interpreter)