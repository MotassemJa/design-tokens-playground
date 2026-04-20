# Universal Tokens (Layer 1)

## Overview

Universal tokens are the foundation of the design token hierarchy. They represent primitive, raw values that have no semantic meaning or context. Universal tokens are **self-contained** and do not reference any other token layers.

## Purpose

- Define primitive color values, spacing units, typography families, and other fundamental design attributes
- Serve as the single source of truth for raw design values
- Cannot be modified or enhanced through references—they are the base building blocks

## Naming Convention

Universal tokens follow the pattern:
```
universal.{category}.{property}
```

### Valid Categories

- `color`: Primitive colors (e.g., `universal.color.red`, `universal.color.blue`)
- `spacing`: Dimensional units (e.g., `universal.spacing.4`, `universal.spacing.16`)
- `font`: Typography primitives:
  - `universal.font.family.{name}`: Font families (e.g., `universal.font.family.sans`)
  - `universal.font.weight.{weight}`: Font weights (e.g., `universal.font.weight.bold`)
- `size`: Font sizes (e.g., `universal.size.12`, `universal.size.16`)
- `duration`: Animation durations (e.g., `universal.duration.200`)

## Inheritance Rules

⚠️ **Universal tokens CANNOT reference any other layer.** They are self-contained and form the foundation of the hierarchy.

```
universal → (NO REFERENCES)
```

## Example Structure

```json
{
  "universal": {
    "color": {
      "red": {
        "$value": "#EF4444",
        "$type": "color",
        "$description": "Universal red - primitive red color value"
      },
      "blue": {
        "$value": "#3B82F6",
        "$type": "color",
        "$description": "Universal blue - primitive blue color value"
      }
    },
    "spacing": {
      "4": {
        "$value": "0.25rem",
        "$type": "dimension",
        "$description": "Universal spacing 4px (base unit)"
      },
      "16": {
        "$value": "1rem",
        "$type": "dimension",
        "$description": "Universal spacing 16px (4x base)"
      }
    }
  }
}
```

## Valid $type Values

| Category | Valid $type |
|----------|------------|
| Color | `color` |
| Spacing | `dimension` |
| Font Family | `fontFamily` |
| Font Weight | `fontWeight` |
| Font Size | `fontSize` |
| Duration | `duration` |

## Hierarchy Position

```
┌─────────────────────────────────────┐
│  1. UNIVERSAL (Foundation Layer)    │ ← You are here
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
│  4. COMPONENT (UI Layer)            │
│  - Composed, ready-to-use styles    │
│  - References: semantic only        │
└─────────────────────────────────────┘
```

## Files

- `base.colors.tokens.json`: Universal color primitives
- `base.spacing.tokens.json`: Universal spacing units
- `base.typography.tokens.json`: Universal typography primitives

## See Also

- [System Tokens](../system/README.md) — Theme-aware tokens that reference universal values
- [Semantic Tokens](../semantic/README.md) — Intent-driven tokens that reference system values
- [Component Tokens](../component/README.md) — UI component tokens that reference semantic values
- [Main README](../../README.md) — Token hierarchy overview and architecture
