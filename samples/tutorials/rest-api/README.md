# REST API Tutorial Sample

This is the complete sample project for the REST API tutorial.

## Structure

```
rest-api/
├── specs/
│   └── users.isl
├── src/
│   └── server.ts
└── package.json
```

## Running

```bash
# Install dependencies
npm install

# Verify the spec
shipgate check specs/users.isl

# Verify implementation
shipgate verify specs/users.isl --impl src/server.ts

# Run gate
shipgate gate specs/users.isl --impl src/server.ts

# Start server
npm start
```
