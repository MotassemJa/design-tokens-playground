# System Tokens (Layer 2)

## Overview

System tokens are theme-aware design tokens that transform universal primitives into system-level values. They add context, themes, and domain-specific variations while **only referencing universal tokens**.

## Purpose

- Introduce theme variations (light, dark, high-contrast, etc.)
- Create domain-specific groupings (brand, feedback, background, text, etc.)
- Bridge the gap between primitive values and semantic intent
- Enable consistent theming across the design system

## Naming Convention

System tokens follow the pattern:
```
system.{theme}.{domain}.{concept}.{property}
```

### Components

- **theme** (optional): Theme variant (e.g., `light`, `dark`, `high-contrast`)
- **domain**: Semantic category (e.g., `color`, `spacing`, `typography`)
- **concept**: Conceptual grouping (e.g., `brand`, `feedback`, `background`, `text`, `component`)
- **property**: Specific property (e.g., `primary`, `error`, `padding-horizontal`)

### Examples

- `system.light.color.brand.primary` → Light theme brand primary color
- `system.dark.color.feedback.error` → Dark theme feedback error color
- `system.spacing.component.button.padding-horizontal` → Button horizontal padding
- `system.color.brand.secondary` → Shared brand secondary color (no theme)

## Inheritance Rules

System tokens can **ONLY reference universal tokens**. References to semantic or component layers are invalid.

```
universal ← (referenced by) ← system → (references only) → universal
```

## Example Structure

### Light Theme

```json
{
  "system": {
    "light": {
      "color": {
        "brand": {
          "primary": {
            "$value": "{universal.color.blue}",
            "$type": "color",
            "$description": "System light theme brand primary"
          }
        },
        "feedback": {
          "success": {
            "$value": "{universal.color.green}",
            "$type": "color",
            "$description": "System light theme feedback success"
          },
          "error": {
            "$value": "{universal.color.red}",
            "$type": "color",
            "$description": "System light theme feedback error"
          }
        }
      }
    }
  }
}
```

### Dark Theme

```json
{
  "system": {
    "dark": {
      "color": {
        "brand": {
          "primary": {
            "$value": "#60A5FA",
            "$type": "color",
            "$description": "System dark theme brand primary (lighter for contrast)"
          }
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
│  2. SYSTEM (Theme Layer)            │ ← You are here
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
│  4. COMPONENT (UI Layer)            │
│  - Composed, ready-to-use styles    │
│  - References: semantic only        │
└─────────────────────────────────────┘
```

## Files

- `theme.colors.tokens.json`: Light, dark, and other theme color variations
- `theme.spacing.tokens.json`: System-level spacing for components and layout

## Valid $type Values

Same as universal layer (see [Universal Tokens](../universal/README.md#valid-type-values))

## Common Domain Groupings

| Domain | Concept Examples | Purpose |
|--------|------------------|---------|
| `color` | `brand`, `feedback`, `background`, `text`, `surface` | Color tokens organized by purpose |
| `spacing` | `component`, `layout` | Spacing tokens for components and layout structure |
| `typography` | `heading`, `body`, `label` | Typography tokens organized by use case |

## Tips & Best Practices

1. **Always use universal references**: `{universal.color.red}` not `#EF4444`
2. **Theme consistently**: If you define a light theme, ensure dark theme has equivalent concepts
3. **Use meaningful concepts**: `brand.primary` is clearer than `color.special-1`
4. **Document transformations**: Add `$description` if the system value differs from universal (e.g., lighter shade for dark theme)

## See Also

- [Universal Tokens](../universal/README.md) — Primitive values
- [Semantic Tokens](../semantic/README.md) — Intent-driven tokens that reference system values
- [Component Tokens](../component/README.md) — UI tokens that reference semantic values
- [Main README](../../README.md) — Token hierarchy overview and architecture
