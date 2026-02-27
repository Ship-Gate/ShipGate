# ISL LSP Samples Workspace

This workspace contains example ISL files for testing the Language Server Protocol features.

## Files

- `valid-domain.isl` - A valid ISL domain with entities and behaviors
- `type-error.isl` - Contains intentional type errors for testing diagnostics
- `completion-test.isl` - File for testing autocomplete suggestions
- `definition-test.isl` - File for testing go-to-definition

## Testing LSP Features

### Diagnostics
1. Open `type-error.isl`
2. Red squiggles should appear on lines with errors
3. Run "ShipGate: Validate ISL" command
4. Check Problems panel for diagnostics

### Completion
1. Open `completion-test.isl`
2. Type `entity ` and press Ctrl+Space
3. Should see suggestions for entity fields, types, etc.

### Go to Definition
1. Open `definition-test.isl`
2. Ctrl+Click on an entity or behavior name
3. Should jump to its definition

### Hover
1. Hover over any symbol (entity, behavior, type)
2. Should show type information and documentation
