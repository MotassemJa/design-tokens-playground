# Component Tokens (Layer 4)

## Overview

Component tokens are collections of design tokens that compose complete component styles and ready-to-use UI patterns. They **only reference semantic tokens** and represent the final, composed output of the token hierarchy.

## Purpose

- Provide complete, ready-to-use component styles
- Hide complexity of underlying semantic/system/universal layers
- Enable direct consumption by UI component libraries
- Maintain consistency across component implementations

## Naming Convention

Component tokens follow the pattern:
```
component.{component}.{variant}.{property}
```

### Components

- **component**: UI component type (e.g., `button`, `card`, `input`, `modal`, `navbar`)
- **variant**: Specific variant (e.g., `primary`, `secondary`, `success`, `error`, `disabled`)
- **property**: CSS property or composed group (e.g., `background`, `text`, `padding`, `border-radius`)

### Examples

- `component.button.primary.background` → Background color for primary button
- `component.button.primary.padding` → Padding for primary button
- `component.card.background` → Card background color
- `component.input.border` → Input field border
- `component.input-focus.border` → Input field border in focus state

## Inheritance Rules

Component tokens can **ONLY reference semantic tokens**. References to universal, system, or other component layers are invalid.

```
universal → system → semantic ← (referenced by) ← component → (references only) → semantic
```

## Example Structure

```json
{
  "component": {
    "button": {
      "primary": {
        "background": {
          "$value": "{semantic.color.action.primary}",
          "$type": "color",
          "$description": "Background color for primary buttons"
        },
        "text": {
          "$value": "{semantic.color.text.primary}",
          "$type": "color",
          "$description": "Text color for primary buttons"
        },
        "padding": {
          "$value": "{semantic.spacing.component.button.padding}",
          "$type": "dimension",
          "$description": "Padding for primary buttons"
        },
        "border-radius": {
          "$value": "0.375rem",
          "$type": "borderRadius",
          "$description": "Border radius for primary buttons"
        }
      },
      "secondary": {
        "background": {
          "$value": "{semantic.color.action.secondary}",
          "$type": "color",
          "$description": "Background color for secondary buttons"
        }
      },
      "success": {
        "background": {
          "$value": "{semantic.color.feedback.success}",
          "$type": "color",
          "$description": "Background color for success buttons"
        }
      },
      "error": {
        "background": {
          "$value": "{semantic.color.feedback.error}",
          "$type": "color",
          "$description": "Background color for error/destructive buttons"
        }
      }
    },
    "card": {
      "background": {
        "$value": "{semantic.color.background.default}",
        "$type": "color",
        "$description": "Background color for cards"
      },
      "padding": {
        "$value": "{semantic.spacing.component.card.padding}",
        "$type": "dimension",
        "$description": "Padding for cards"
      },
      "border-radius": {
        "$value": "0.5rem",
        "$type": "borderRadius",
        "$description": "Border radius for cards"
      },
      "shadow": {
        "$value": "0 4px 6px rgba(0, 0, 0, 0.1)",
        "$type": "shadow",
        "$description": "Shadow for cards"
      }
    },
    "input": {
      "background": {
        "$value": "{semantic.color.background.default}",
        "$type": "color",
        "$description": "Background color for input fields"
      },
      "text": {
        "$value": "{semantic.color.text.primary}",
        "$type": "color",
        "$description": "Text color for input fields"
      },
      "border": {
        "$value": "1px solid #D1D5DB",
        "$type": "border",
        "$description": "Border for input fields"
      },
      "padding": {
        "$value": "{semantic.spacing.component.input.padding}",
        "$type": "dimension",
        "$description": "Padding for input fields"
      }
    }
  }
}
```

## Hierarchy Position

```
┌─────────────────────────────────────┐
│  1. UNIVERSAL (Foundation Layer)    │
│  - Primitive values only            │
│  - No references                    │
└─────────────────────────────────────┘
           ↓ (referenced by)
┌─────────────────────────────────────┐
│  2. SYSTEM (Theme Layer)            │
│  - Theme-aware, system-level tokens │
│  - References: universal only       │
└─────────────────────────────────────┘
           ↓ (referenced by)
┌─────────────────────────────────────┐
│  3. SEMANTIC (Intent Layer)         │
│  - Purpose-driven, context-aware    │
│  - References: system only          │
└─────────────────────────────────────┘
           ↓ (referenced by)
┌─────────────────────────────────────┐
│  4. COMPONENT (UI Layer)            │ ← You are here
│  - Composed, ready-to-use styles    │
│  - References: semantic only        │
└─────────────────────────────────────┘
```

## Common Components

| Component | Variants | Properties |
|-----------|----------|-----------|
| **button** | primary, secondary, success, error, disabled | background, text, padding, border-radius, border |
| **card** | default | background, padding, border-radius, shadow |
| **input** | default | background, text, border, padding, border-radius |
| **input-focus** | default | border, outline |
| **modal** | default | background, padding, border-radius, shadow |
| **navbar** | default | background, padding, text |

## Files

- `components.example.tokens.json`: Example component tokens demonstrating proper semantic references

## Valid $type Values

Same as all other layers (see [Universal Tokens](../universal/README.md#valid-type-values))

## Tips & Best Practices

1. **Only reference semantic tokens**: Use `{semantic.color.action.primary}` not `{system.light.color.brand.primary}`
2. **Group related properties**: Keep all properties for a single variant together
3. **Include state variants**: Support common states like `hover`, `focus`, `disabled`, `active`
4. **Document variants clearly**: Help consumers understand when to use each variant
5. **Don't duplicate semantics**: If a semantic token already exists for something, reference it instead of creating a new value
6. **Consider composition**: Component tokens should be easily composable into larger patterns

## See Also

- [Universal Tokens](../universal/README.md) — Primitive values
- [System Tokens](../system/README.md) — Theme-aware tokens that reference universal values
- [Semantic Tokens](../semantic/README.md) — Intent-driven tokens that reference system values
- [Main README](../../README.md) — Token hierarchy overview and architecture
# Component Tokens

Component tokens are collections of design tokens that compose complete component styles. They typically **inherit** or **reference** semantic and base tokens.

## Structure

Component tokens are organized by:
- **Component name**: button, card, input, etc.
- **Variant**: primary, secondary, large, etc.
- **Property**: background, text, padding, etc.

## Examples

### Button Component

```json
{
  "component": {
    "button": {
      "primary": {
        "background": "{semantic.color.interactive.primary}",
        "text": "#ffffff",
        "padding": "{spacing.md}",
        "border-radius": "0.375rem"
      },
      "secondary": {
        "background": "{semantic.color.interactive.secondary}",
        "text": "#ffffff",
        "padding": "{spacing.md}",
        "border-radius": "0.375rem"
      }
    }
  }
}
```

### Card Component

```json
{
  "component": {
    "card": {
      "background": "{semantic.color.background.default}",
      "padding": "{spacing.lg}",
      "border-radius": "0.5rem",
      "shadow": "0 4px 6px rgba(0, 0, 0, 0.1)"
    }
  }
}
```

## Token Hierarchy

The design token hierarchy follows this pattern:

```
base tokens (primitives)
    ↓
semantic tokens (intent-based)
    ↓
component tokens (composed styles)
```

Example:
```
color.bright-cyan = #03AACE (base)
  ↓
semantic.color.interactive.primary = {color.bright-cyan} (semantic)
  ↓
component.button.primary.background = {semantic.color.interactive.primary} (component)
```

## Benefits

1. **Reusability**: Compose tokens from existing semantic/base tokens
2. **Consistency**: Ensure components use consistent styling
3. **Maintainability**: Update component styles in one place
4. **Documentation**: Clear mapping of which tokens each component uses
5. **Scalability**: Easy to add new component variants

## Usage in Code

### CSS (via Style Dictionary)
```css
/* Using component tokens */
.btn-primary {
  background-color: var(--ds-component-button-primary-background);
  color: var(--ds-component-button-primary-text);
  padding: var(--ds-component-button-primary-padding);
  border-radius: var(--ds-component-button-primary-border-radius);
}
```

### JavaScript
```javascript
import { component } from '@your-org/design-tokens';

const buttonStyles = {
  backgroundColor: component.button.primary.background,
  color: component.button.primary.text,
  padding: component.button.primary.padding,
};
```

## Creating New Component Tokens

1. Identify which component you want to tokenize
2. List all properties (colors, spacing, shadows, etc.)
3. Reference existing semantic or base tokens where possible
4. Group variants (primary, secondary, disabled, etc.)
5. Document the component's purpose and usage
