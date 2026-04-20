# Development Guide

This guide helps developers understand and work with the design tokens system.

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Git

### Installation

```bash
git clone <repository>
cd design-tokens-playground
npm install
```

### Building Tokens

```bash
npm run build
```

This generates:
- `dist/css/variables.css` - CSS variables for use in web projects
- `dist/tokens.json` - Raw token export in JSON format
- `dist/tokens.resolved.json` - Reference-resolved token export
- `dist/tokens.interpreted.json` - Best-effort interpreted token values
- `dist/tokens.js` - JavaScript module export

## Project Structure

```
├── tokens/                           # Source token files
│   ├── color/base.tokens.json       # Base color tokens
│   ├── spacing/base.tokens.json     # Spacing tokens
│   ├── semantic/colors.tokens.json  # Semantic color tokens
│   └── component/base.tokens.json   # Component-level tokens
│
├── src/
│   ├── index.ts                     # CLI entrypoint
│   ├── build-tokens.ts              # Build pipeline
│   ├── build-config.ts              # Style Dictionary config builder
│   ├── token-loader.ts              # Recursive token file discovery + merge
│   ├── token-reference-resolver.ts  # Reference/interpolation resolver
│   └── token-validator.ts           # Runtime schema validation
│
├── preview/
│   ├── index.html                   # Interactive token preview app
│   └── README.md                    # Preview tool documentation
│
├── .github/
│   ├── workflows/                   # GitHub Actions workflows
│   │   ├── create-token.yaml       # Automated token creation
│   │   ├── update-token.yaml       # Automated token updates
│   │   ├── delete-token.yaml       # Automated token deletion
│   │   ├── build-tokens.yaml       # Build and test workflow
│   │   └── publish-npm.yaml        # NPM publishing workflow
│   │
│   ├── scripts/                     # Token management scripts
│   │   ├── token-common.ts         # Shared token utilities
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
│   ├── css/
│   │   └── variables.css            # CSS variables
│   ├── tokens.json                  # Raw JSON export
│   ├── tokens.resolved.json         # Resolved JSON export
│   ├── tokens.interpreted.json      # Interpreted JSON export (best-effort)
│   └── tokens.js                    # JavaScript module
│
└── README.md                        # Main project documentation
```

## Working with Tokens

### File Format

All tokens follow the DTCG (Design Tokens Community Group) specification:

```json
{
  "color": {
    "primary": {
      "$value": "#3B82F6",           // The actual value
      "$type": "color",              // Token type
      "$description": "Primary color",// Human-readable description
      "$extensions": {}              // Optional extensions
    }
  }
}
```

### Supported Token Types

```typescript
// Colors
$type: "color"

// Sizing and spacing
$type: "dimension"

// Time
$type: "duration"

// Typography
$type: "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" |
       "letterSpacing" | "paragraphSpacing" | "textDecoration" |
       "textTransform" | "fontStyle" | "fontVariant"

// Effects
$type: "opacity" | "border" | "borderRadius" | "shadow" | "gradient"

// Composed types
$type: "strokeStyle" | "transition" | "typography" | "transform" | "composition"
```

## Token Validation

Tokens are validated at build time with runtime checks:

- ✅ Required `$value` property
- ✅ Valid `$type` values
- ✅ Type-specific value format validation
- ✅ Reference resolution (e.g., `{color.primary}`)
- ✅ Color format validation (hex, rgb, hsl)
- ✅ Duration format validation (ms, s)

Compatibility behavior:
- Legacy `$type: "spacing"` is accepted and treated as `dimension` with warnings.

## TokenScript Processing Model

- The build runs TokenScript interpretation in best-effort mode.
- Unsupported expressions are reported as warnings and do not fail the build.
- For affected tokens, original values are preserved.
- CSS-native values such as `clamp(...)` and `rgba(...)` can remain as literals when not interpreted.

### Validation in Action

```bash
# This will fail validation (invalid color format)
npx tsx .github/scripts/create-token.ts \
  --category color \
  --name my-color \
  --value "not-a-color"

# Output:
# ❌ Token validation failed:
#   - Token at path 'my-color': invalid color value
```

## Token References

Tokens can reference other tokens using `{path.to.token}` syntax:

```json
{
  "color": {
    "bright-cyan": {
      "$value": "#03AACE",
      "$type": "color"
    },
    "primary": {
      "$value": "{color.bright-cyan}",  // References the blue color
      "$type": "color",
      "$description": "Primary uses bright cyan"
    }
  }
}
```

This creates:
- **Maintainability**: Update one value, and references update automatically
- **Flexibility**: Swap implementations without changing dependent tokens
- **Semantic clarity**: Show intent through references

Reference resolver details:
- Exact references (`{path.to.token}`) are resolved.
- Embedded references in strings (for example `1px solid {color.warm-pink}`) are interpolated.
- Circular references are detected and warned.

## Using Tokens in Code

### CSS Variables
```css
:root {
  /* Generated from tokens/color/base.tokens.json */
  --ds-color-primary: #03AACE;
  --ds-color-warm-pink: #F25E86;
  --ds-spacing-md: 1rem;
}

.button {
  background-color: var(--ds-color-primary);
  padding: var(--ds-spacing-md);
}
```

### React Component
```jsx
import { colors, spacing } from '@your-org/design-tokens';

export function Button({ children }) {
  return (
    <button
      style={{
        backgroundColor: colors.primary,
        padding: spacing.md,
      }}
    >
      {children}
    </button>
  );
}
```

### Web Components
```javascript
import tokens from '@your-org/design-tokens/tokens';

class MyButton extends HTMLElement {
  connectedCallback() {
    this.style.backgroundColor = tokens.color.primary.$value;
    this.style.padding = tokens.spacing.md.$value;
  }
}
```

## Preview Tool

The interactive preview tool helps developers:
1. **Browse** all available tokens
2. **Search** by name, value, or description
3. **Copy** token values with one click
4. **Filter** by category
5. **Visualize** colors with inline previews

### Accessing Preview

```bash
npm run build
# Then open: preview/index.html
```

Or live development (tokens loaded from source):
```bash
# Just open: preview/index.html directly
```

## Adding New Token Categories

1. **Create a new token file:**
   ```bash
   touch tokens/typography/base.tokens.json
   ```

2. **Add tokens following DTCG format:**
   ```json
   {
     "typography": {
       "heading-1": {
         "$value": {
           "fontSize": "32px",
           "fontWeight": "700",
           "lineHeight": "1.2"
         },
         "$type": "typography",
         "$description": "Heading 1 typography"
       }
     }
   }
   ```

3. **Update issue templates** to include the new category:
   - Edit `.github/ISSUE_TEMPLATE/create-token.yaml`
   - Add option under `category` dropdown

4. **Build and test:**
   ```bash
   npm run build
   # Verify output in dist/
   ```

## Publishing Changes

### Manual Publishing

Note on CI permissions: The automated token workflows may need to push branches and create pull requests on your behalf. If GitHub Actions is not permitted to create PRs in your repository, add a repository secret named `ACTIONS_PAT` containing a personal access token with `repo` scope (or at minimum `contents`, `pull_requests`, `issues`). Workflows will use `ACTIONS_PAT` as a fallback when `GITHUB_TOKEN` is restricted. See `.github/workflows/create-token.yaml` for implementation details.

```bash
npm run build
npm publish
```

### Automated Publishing (Recommended)

1. Create a new Release on GitHub
2. The `publish-npm.yaml` workflow automatically:
   - Builds tokens
   - Runs validation
   - Publishes to NPM
   - Creates a comment linking to the npm package

## Troubleshooting

### Build Fails with Validation Errors

```
❌ Token validation failed:
  - Token at path 'color.invalid': invalid color value
```

**Solution**: Check the token value matches expected format:
```json
{
  "color": {
    "invalid": {
      "$value": "#GGGGGG",  // Invalid hex
      "$type": "color"
    }
  }
}
```

Fix: Use valid hex format `#000000`

### CSS Variables Not Generated

```bash
# Check if build ran successfully
npm run build

# Verify dist/css/variables.css exists
ls -la dist/css/

# If missing, check src/index.ts configuration
```

### Token References Not Resolving

```json
{
  "color": {
    "primary": {
      "$value": "{color.undefined}",  // ❌ This token doesn't exist
      "$type": "color"
    }
  }
}
```

**Solution**: Use exact path to existing token. Check `tokens/` directory for available tokens.

## Next Steps

1. **Add more tokens** to `tokens/` directory
2. **Integrate into projects** using CSS variables or JS imports
3. **Set up CI/CD** to validate tokens on every PR
4. **Create design system documentation** with token usage guidelines

## Resources

- [DTCG Design Tokens Format Module](https://tr.w3.org/design-tokens/)
- [Style Dictionary Documentation](https://styledictionary.com/)
- [Design Tokens Best Practices](https://DesignTokens.org/)
