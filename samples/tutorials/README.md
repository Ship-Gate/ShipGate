# Tutorial Samples

Complete sample projects for IntentOS tutorials.

## Samples

- `hello-world/` - Hello World tutorial sample
- `rest-api/` - REST API tutorial sample
- `auth/` - Authentication tutorial sample
- `pbt/` - Property-based testing tutorial sample
- `chaos/` - Chaos testing tutorial sample

Each sample includes:
- Complete ISL specifications
- Working implementations
- Tests
- README with instructions

## Usage

Each sample can be run independently:

```bash
cd samples/tutorials/hello-world
shipgate check specs/
shipgate verify specs/ --impl src/
shipgate gate specs/ --impl src/
```

## Testing Tutorials

Run the CI test script to verify all tutorials:

```bash
npm run test:tutorials
```
