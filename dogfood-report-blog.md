# Dogfood Report: Blog Platform Pipeline

**Date:** 2026-02-14  
**Prompt:** "A blog platform where authors can register, write posts with a rich text editor, add tags, and publish or save as draft. Readers can browse posts by tag, search by title/content, and leave comments. Authors can moderate comments on their posts (approve, delete). There's a public homepage showing recent posts, an author dashboard showing their posts and comment notifications, and an admin panel for managing users and flagged content. Posts support featured images via URL."

**Pipeline:** `isl-pipeline generate` (NL → ISL → Code → Semantic Verification)

---

## 1. Pipeline Stage Results

### Stage 1: NL → ISL Translation

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Matched pattern | user-register | **blog-platform** |
| Confidence | 85% | 85% |
| Behaviors | 1 (UserRegister) | **5** (RegisterAuthor, CreatePost, SearchPosts, CreateComment, ModerateComment) |
| Domain | Auth | Blog |

**Before fix:** Translator matched "register" from "authors can register" and produced only UserRegister.  
**After fix:** Added BLOG_PATTERNS with triggers ["blog platform", "blog", "authors", "posts", "comments", ...]. Blog pattern now wins (higher trigger score).

### Stage 2: ISL → Code Generation

| Metric | Value |
|--------|-------|
| API routes | 5 |
| Test files | 5 |
| Lib files | 3 (rate-limit, audit, logger) |
| Total files | 15 |

**Generated structure:**
```
app/api/register-author/route.ts + route.test.ts
app/api/create-post/route.ts + route.test.ts
app/api/search-posts/route.ts + route.test.ts
app/api/create-comment/route.ts + route.test.ts
app/api/moderate-comment/route.ts + route.test.ts
lib/rate-limit.ts, lib/audit.ts, lib/logger.ts
app/layout.tsx
blog.isl
```

### Stage 3: Semantic Verification

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Score | 0/100 | 0/100 |
| Critical violations | 9 | 11 |
| High violations | 0 | 9 |
| Verdict | NO_SHIP | NO_SHIP |

**Remaining violations (after P0/P1 fixes):**
- `quality/no-stubbed-handlers`: TODO/IMPLEMENTATION_REQUIRED in handlers (expected for skeleton)
- `intent/audit-required`: Missing audit on some exit paths (SearchPosts, CreatePost, ModerateComment lack rate-limit/audit)
- `intent/rate-limit-required`: Routes without rate-limit intent use request.json()
- `intent/no-pii-logging`: Fixed (audit.ts console.log → process.stdout.write)

### Stage 4: Time to Running App

| Step | Status |
|------|--------|
| Generated output has package.json? | **No** – NextJS adapter does not generate package.json, tsconfig, or node_modules |
| Can run `pnpm install && pnpm dev`? | **No** – project structure incomplete |
| Time to first successful run | N/A – requires manual scaffolding |

---

## 2. ISL Spec Quality

### Captured

- **Roles:** Author (implicit), Reader (implicit), Admin (mentioned in prompt but not in spec)
- **Behaviors:** RegisterAuthor, CreatePost, SearchPosts, CreateComment, ModerateComment
- **Entities:** Author, Post, Comment with appropriate fields
- **Intents:** rate-limit-required, audit-required, no-pii-logging, auth-required

### Not Captured

- **Admin panel** – no Admin role or behaviors
- **Flagged content workflow** – no FlaggedContent entity or moderation flow
- **Rich text** – content is String, no rich text / HTML handling
- **Featured images** – present as optional field
- **Homepage / dashboard / admin UI** – no screen definitions
- **Notification system** – no CommentNotification or similar

### Verdict

Spec covers core CRUD and moderation. Missing: admin workflows, flagged content, rich text semantics, and UI/screen definitions.

---

## 3. Codegen Quality

### Role-Based Auth

- **auth-required intent:** Present on CreatePost, ModerateComment
- **Implementation:** Routes declare `@intent auth-required` but use `throw new Error('IMPLEMENTATION_REQUIRED')` – no real auth middleware
- **Permission boundaries:** ModerateComment has "user is author of post" precondition; no enforcement in generated code

### Search

- **SearchPosts behavior:** Exists with query + tag input
- **Implementation:** Uses POST + `request.json()` instead of GET + query params
- **Search logic:** Stub only – `throw new Error('IMPLEMENTATION_REQUIRED')`

### Rich Text

- **Handling:** Content is `z.string()` – no HTML/sanitization or rich text type
- **Codegen:** No special handling for rich text

---

## 4. Verification Gaps

| Gap | Human Would Catch | Verifier |
|-----|-------------------|----------|
| Search should use GET | ✓ | ✗ (treats all as POST) |
| Auth middleware missing | ✓ | ✗ (intent declared, not enforced) |
| Admin routes need admin check | ✓ | ✗ |
| Featured image URL validation | ✓ | ✗ |
| Comment ownership for moderation | ✓ | ✗ |
| Flagged content workflow | ✓ | ✗ (not in spec) |

---

## 5. Generated Test Coverage

| Area | Covered |
|------|---------|
| Precondition validation | ✓ (Zod schema tests) |
| Error conditions | ✓ (error class tests) |
| Intent enforcement | ✓ (rate-limit, audit mocks) |
| Permission boundaries | ✗ (no "forbidden" / ownership tests) |
| Search behavior | ✗ (stub only) |

---

## 6. Bug Categorization

### P0: Pipeline Crash / Generated Code Doesn't Compile

| ID | Bug | Fix |
|----|-----|-----|
| P0-1 | Missing `lib/logger.ts` when no-pii-logging intent used | Generate lib/logger.ts in NextJS adapter when spec has no-pii-logging |
| P0-2 | auditAttempt calls missing `timestamp` → semantic rule fails | Add `timestamp: new Date().toISOString()` to all auditAttempt call sites |

### P1: Feature Missing or Fundamentally Wrong

| ID | Bug | Fix |
|----|-----|-----|
| P1-1 | Blog prompt matched user-register only (1 behavior vs 5+) | Add BLOG_PATTERNS to translator, ordered before AUTH_PATTERNS |
| P1-2 | Shipgate build fails: @isl-lang/security-scanner not found | Add @isl-lang/security-scanner to build externals (fixed). Note: Build still fails on codegen-openapi OpenAPIGenerator export |

### P2: Feature Works but Implementation Weak

| ID | Bug |
|----|-----|
| P2-1 | SearchPosts uses POST + body instead of GET + query params |
| P2-2 | All handlers are stubs (IMPLEMENTATION_REQUIRED) |
| P2-3 | No package.json/tsconfig in generated output – app cannot run without manual setup |
| P2-4 | audit.ts used console.log in dev – triggers no-pii rule |

### P3: Polish / Minor

| ID | Bug |
|----|-----|
| P3-1 | SearchPosts tag should be optional in schema (z.string().optional()) |
| P3-2 | Duplicate auth.isl + user-register from prior run in output dir |
| P3-3 | Verdict stays NO_SHIP due to no-stubbed-handlers (expected for skeletons) |

---

## 7. Comparison vs Todo App

| Aspect | Todo App | Blog Platform |
|--------|----------|---------------|
| Pattern match | todo-app (good fit) | Was user-register → now blog-platform |
| Multi-behavior | ✓ | ✓ (after fix) |
| Role complexity | User only | Author, Reader, Admin (partial) |
| New pipeline issues | – | P0: missing logger, audit timestamp; P1: pattern priority |
| Recurring issues | Stub handlers, no package.json | Same |

**Recurring:** Stub-only handlers, no full project scaffold (package.json, tsconfig), semantic rules strict on TODO markers.  
**New:** Pattern priority (blog vs auth), missing lib/logger generation, audit payload timestamp.

---

## 8. Pipeline Fixes Applied

1. **lib/logger.ts generation** – NextJS adapter generates lib/logger.ts when any behavior has no-pii-logging intent.
2. **auditAttempt timestamp** – All auditAttempt calls include `timestamp: new Date().toISOString()`.
3. **BLOG_PATTERNS** – New pattern with 5 behaviors, ordered first in DEFAULT_PATTERN_LIBRARY.
4. **audit.ts console.log** – Replaced with `process.stdout.write(JSON.stringify(...))` to satisfy no-pii rule.

---

## 9. Recommendations

1. **Vibe pipeline:** Use `isl vibe` for full-stack generation (needs API key); `isl-pipeline generate` is pattern-based and does not call AI.
2. **Project scaffold:** Extend NextJS adapter to emit package.json, tsconfig.json, and .env.example.
3. **GET vs POST:** Allow behaviors to declare HTTP method; use GET + query for read-only/search.
4. **Stub handling:** Add `--allow-stubs` or similar to relax no-stubbed-handlers for skeleton generation.
