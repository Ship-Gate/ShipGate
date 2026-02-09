# API & Data Patterns



## API Routes

### Existing Endpoints
- `/admin`
- `/users`
- `/index`
- `/generator`
- `/analytics`
- `/domains`
- `/verifications`
- `/intents`
- `/search`
- `/trust`
- `/cli.d`
- `/cli`
- `/documents.d`
- `/documents`
- `/features/completion.d`
- `/features/completion`
- `/features/definition.d`
- `/features/definition`
- `/features/diagnostics.d`
- `/features/diagnostics`

### API Response Pattern
```typescript
// Success
return Response.json({ data, success: true })

// Error
return Response.json({ error: message }, { status: 400 })
```

### Validation
Use Zod for input validation:
```typescript
const schema = z.object({ name: z.string() })
const data = schema.parse(await req.json())
```



