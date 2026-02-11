# API Builder Skill

## When to Use
When creating new API endpoints, routes, or handlers.

## Project API Conventions
- Framework: nextjs-app-router
- Existing routes: 838

## Endpoint Creation Process
1. Check if similar endpoint exists (no duplicates!)
2. Follow existing route patterns
3. Add request validation
4. Implement proper error handling
5. Add to appropriate router

## Template
```typescript
export async function handler(req: Request, res: Response) {
  try {
    // Validate input
    const validated = schema.parse(req.body);
    
    // Process
    const result = await service.process(validated);
    
    // Respond
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```
