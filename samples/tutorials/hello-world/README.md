# Hello World Tutorial Sample

This is the complete sample project for the Hello World tutorial.

## Structure

```
hello-world/
├── specs/
│   └── greeter.isl
├── src/
│   ├── greeter.ts
│   └── greeter.test.ts
└── package.json
```

## Running

```bash
# Verify the spec
shipgate check specs/greeter.isl

# Verify implementation
shipgate verify specs/greeter.isl --impl src/greeter.ts

# Run gate
shipgate gate specs/greeter.isl --impl src/greeter.ts

# Run tests
npm test
```
