# Codebase Navigation Skill

## When to Use
Activate this skill when:
- You need to find where something is implemented
- You need to understand the project structure
- You need to find related files for a change
- You need to understand the dependency graph

## Instructions
1. **Start with truthpack**: The truthpack maps routes → files, giving you entry points
2. **Follow imports**: Trace the import chain to understand dependencies
3. **Check neighbors**: Files in the same directory usually follow the same patterns
4. **Read tests**: Test files reveal intended behavior and edge cases
5. **Check configs**: tsconfig, package.json, and .env reveal project setup

## Project Map
### API Entry Points
- `GET /vibe-test6/src/app/api/v1/tasks` → `/vibe-test6/src/app/api/v1/tasks/route.ts`
- `POST /vibe-test6/src/app/api/v1/tasks` → `/vibe-test6/src/app/api/v1/tasks/route.ts`
- `POST /dogfood-blog-output/app/api/register-author` → `/dogfood-blog-output/app/api/register-author/route.ts`
- `POST /dogfood-blog-output/app/api/user-register` → `/dogfood-blog-output/app/api/user-register/route.ts`
- `POST /dogfood-blog-output/app/api/search-posts` → `/dogfood-blog-output/app/api/search-posts/route.ts`
- `POST /dogfood-blog-output/app/api/create-post` → `/dogfood-blog-output/app/api/create-post/route.ts`
- `POST /dogfood-blog-output/app/api/moderate-comment` → `/dogfood-blog-output/app/api/moderate-comment/route.ts`
- `POST /dogfood-blog-output/app/api/create-comment` → `/dogfood-blog-output/app/api/create-comment/route.ts`

### Key Environment
- `CI` → `.env.example`
- `ISL_AI_ENABLED` → `.env.example`
- `ISL_AI_PROVIDER` → `.env.example`
- `PORT` → `.env.example`
- `NODE_ENV` → `.env.example`

## Navigation Tips
- Use the truthpack as your map — it's verified ground truth
- When lost, start from the route handler and trace inward
- Check `.vibecheck/truthpack/meta.json` for project summary

---
<!-- vibecheck:context-engine:v1 -->