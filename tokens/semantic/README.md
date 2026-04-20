# Semantic Tokens (Layer 3)

## Overview

Semantic tokens provide meaningful names for design tokens that describe their **purpose** and **usage context**. They add intent and meaning to system tokens while **only referencing system tokens**.

## Purpose

- Communicate token purpose and intent (e.g., "action", "feedback", "background")
- Provide semantic meaning to end consumers
- Hide complexity of theme switching—consumers use semantic tokens regardless of current theme
- Enable consistent semantics across the design system

## Naming Convention

Semantic tokens follow the pattern:
```
semantic.{category}.{intent}.{variant}
```

### Components

- **category**: Design aspect (e.g., `color`, `spacing`, `typography`, `size`)
- **intent**: Purpose of the token (e.g., `action`, `feedback`, `background`, `text`)
- **variant**: Specific variant within intent (e.g., `primary`, `secondary`, `success`, `error`)

### Examples

- `semantic.color.action.primary` → Primary interactive element color
- `semantic.color.feedback.error` → Error/negative feedback color
- `semantic.spacing.component.button.padding` → Button padding
- `semantic.spacing.layout.section-gap` → Gap between major sections

## Inheritance Rules

Semantic tokens can **ONLY reference system tokens**. References to universal or component layers are invalid.

```
universal → system ← (referenced by) ← semantic → (references only) → system
```

## Example Structure

```json
{
  "semantic": {
    "color": {
      "action": {
        "primary": {
          "$value": "{system.light.color.brand.primary}",
          "$type": "color",
          "$description": "Primary action color - CTAs, links, key interactions"
        },
        "secondary": {
          "$value": "{system.light.color.brand.secondary}",
          "$type": "color",
          "$description": "Secondary action color - less prominent interactions"
        }
      },
      "feedback": {
        "success": {
          "$value": "{system.light.color.feedback.success}",
          "$type": "color",
          "$description": "Success state indicator"
        },
        "error": {
          "$value": "{system.light.color.feedback.error}",
          "$type": "color",
          "$description": "Error state indicator"
        }
      },
      "background": {
        "default": {
          "$value": "{system.light.color.background.default}",
          "$type": "color",
          "$description": "Default background for content areas"
        }
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
│  3. SEMANTIC (Intent Layer)         │ ← You are here
│  - Purpose-driven, context-aware    │
│  - References: system only          │
└─────────────────────────────────────┘
           ↓ (referenced by)
┌─────────────────────────────────────┐
│  4. COMPONENT (UI Layer)            │
│  - Composed, ready-to-use styles    │
│  - References: semantic only        │
└─────────────────────────────────────┘
```

## Common Intent Categories

| Category | Intent | Purpose |
|----------|--------|---------|
| **color** | `action` | Interactive elements (buttons, links) |
| | `feedback` | Status indicators (success, error, warning) |
| | `background` | Page/section backgrounds |
| | `text` | Text and typography |
| | `surface` | Card, panel, and container backgrounds |
| **spacing** | `component` | Internal component spacing |
| | `layout` | Spacing between major layout sections |
| **typography** | `heading` | Heading styles |
| | `body` | Body text styles |
| | `label` | Label and caption text |

## Files

- `colors.example.tokens.json`: Semantic color tokens for different intents
- `spacing.example.tokens.json`: Semantic spacing tokens for components and layout

## Valid $type Values

Same as universal and system layers (see [Universal Tokens](../universal/README.md#valid-type-values))

## Tips & Best Practices

1. **Always reference system layer**: Use `{system.light.color.brand.primary}` not `{universal.color.blue}`
2. **Use clear intent names**: `feedback.error`, `action.primary`, `background.secondary` are more meaningful than generic names
3. **Document purpose in $description**: Help consumers understand when to use this token
4. **Keep variants minimal**: Use 2-3 variants per intent (primary, secondary, disabled) rather than many options
5. **Abstract away theme details**: Consumers shouldn't need to know if you're using light or dark theme

## See Also

- [Universal Tokens](../universal/README.md) — Primitive values
- [System Tokens](../system/README.md) — Theme-aware tokens that reference universal values
- [Component Tokens](../component/README.md) — UI tokens that reference semantic values
- [Main README](../../README.md) — Token hierarchy overview and architecture
# Semantic Tokens

Semantic tokens provide meaningful names for design tokens that describe their **purpose** and **usage context** rather than their visual properties.

## Structure

Semantic tokens are organized by:
- **Theme layer**: Interactive, feedback, background, text, etc.
- **Category**: Color, spacing, sizing, etc.
- **Intent**: Primary, secondary, success, error, warning, info, etc.

## Examples

### Color Tokens

```json
{
  "semantic": {
    "color": {
      "interactive": {
        "primary": "{color.bright-cyan}",  // Primary CTAs and key interactions
        "secondary": "{color.warm-pink}"   // Less prominent interactions
      },
      "feedback": {
        "success": "#10b981",    // Positive feedback
        "error": "#ef4444",      // Error states
        "warning": "#f59e0b",    // Warnings
        "info": "#3b82f6"        // Information
      },
      "background": {
        "default": "#ffffff",    // Main background
        "secondary": "#f3f4f6",  // Alternate sections
        "tertiary": "#e5e7eb"    // Interactive elements
      },
      "text": {
        "primary": "#1f2937",    // Main text
        "secondary": "#6b7280",  // Supporting text
        "disabled": "#d1d5db"    // Disabled text
      }
    }
  }
}
```

## Benefits

1. **Semantic meaning**: Clear intent of where and how to use tokens
2. **Maintainability**: Easier to understand and update token usage
3. **Consistency**: Enforces consistent semantic usage across the system
4. **Flexibility**: Can easily remap tokens without changing component code
5. **Accessibility**: Semantic naming helps with understanding purpose

## Relationships

Semantic tokens typically **reference** base tokens (primitive tokens):
- Base tokens: `color.bright-cyan` = `#03AACE` (raw value)
- Semantic tokens: `semantic.color.interactive.primary` = `{color.bright-cyan}` (reference)

This allows you to:
- Update a color in one place
- See changes propagate across all semantic usages
- Swap implementations without breaking components
