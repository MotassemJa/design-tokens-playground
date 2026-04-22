# TokenScript Schema Examples

These files are copy-pasteable examples for extending TokenScript with:

- an OKLCH color schema and `oklch(...)` initializer
- a `clamp_string(...)` custom function that outputs CSS `clamp(...)` as a plain string

## Files

- `color-oklch.schema.json`
- `function-clamp-string.schema.json`

## Why this pattern

TokenScript in this repo currently warns for:

- unknown function calls such as `oklch(...)` (unless you register an initializer)
- mixed-unit arithmetic such as `rem + vw`

The examples here avoid both issues by:

1. defining an explicit color schema + initializer for OKLCH
2. returning `clamp(...)` as a string instead of evaluating mixed-unit math

## Example usage

```tokenscript
variable accent: Color.Oklch = oklch(0.62, 0.2, 255);
variable h6: String = clamp_string("1rem", "0.95rem + 0.35vw", "1.25rem");

return accent.to_string(), h6;
```

## Integration note

This repository includes these as documentation examples only.

To make them active at runtime, register these schemas/functions in your TokenScript runtime configuration before calling `processTokens(...)`.
