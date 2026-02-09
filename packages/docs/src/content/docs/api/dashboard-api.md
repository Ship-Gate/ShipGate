---
title: Dashboard API
description: REST API for verification reports, coverage metrics, and trend analysis.
---

The Dashboard API provides a REST interface for storing and querying verification results, coverage metrics, and drift alerts. Use it to build dashboards and track verification health over time.

## Setup

Install and start the dashboard API:

```bash
npm install @isl-lang/dashboard-api
```

```typescript
import { createDashboardServer } from "@isl-lang/dashboard-api";

const server = createDashboardServer({
  port: 3700,           // Default port
  database: "sqlite",   // SQL.js (SQLite) storage
});

await server.start();
```

Or use the default configuration:

```bash
# Start on default port 3700
npx @isl-lang/dashboard-api
```

## Configuration

| Environment Variable  | Default  | Description                       |
| --------------------- | -------- | --------------------------------- |
| `DASHBOARD_PORT`      | `3700`   | HTTP port                         |
| `DATABASE_PATH`       | `:memory:` | SQLite database file path       |
| `CORS_ORIGINS`        | `*`      | Allowed CORS origins              |
| `RATE_LIMIT_RPM`      | `120`    | Requests per minute limit         |

## Endpoints

### Health check

```
GET /api/v1/health
```

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Verification reports

#### Submit a report

```
POST /api/v1/reports
Content-Type: application/json
```

**Request body:**

```json
{
  "specPath": "specs/user-service.isl",
  "implPath": "src/user-service.ts",
  "verdict": "SHIP",
  "score": 92,
  "confidence": 95,
  "results": {
    "preconditions": { "passed": 8, "failed": 0 },
    "postconditions": { "passed": 12, "failed": 0 },
    "invariants": { "passed": 4, "failed": 0 },
    "scenarios": { "passed": 6, "failed": 0 }
  },
  "commitHash": "abc123",
  "branch": "main"
}
```

**Response:**

```json
{
  "id": "report-uuid-123",
  "created_at": "2026-02-08T12:00:00Z"
}
```

#### List reports

```
GET /api/v1/reports?limit=20&offset=0&verdict=SHIP
```

**Query parameters:**

| Parameter    | Description                         |
| ------------ | ----------------------------------- |
| `limit`      | Number of reports (default: 20)     |
| `offset`     | Pagination offset                   |
| `verdict`    | Filter by verdict: SHIP, NO_SHIP    |
| `branch`     | Filter by git branch                |
| `since`      | Filter by date (ISO 8601)           |

#### Get a single report

```
GET /api/v1/reports/:id
```

### Coverage metrics

#### Submit coverage

```
POST /api/v1/coverage
Content-Type: application/json
```

**Request body:**

```json
{
  "specPath": "specs/user-service.isl",
  "totalBehaviors": 5,
  "verifiedBehaviors": 4,
  "totalAssertions": 32,
  "passedAssertions": 30,
  "coveragePercent": 93.75,
  "commitHash": "abc123"
}
```

#### Get coverage

```
GET /api/v1/coverage?spec=specs/user-service.isl
```

### Trend analysis

#### Get trends

```
GET /api/v1/trends?period=7d&metric=score
```

**Query parameters:**

| Parameter    | Description                              |
| ------------ | ---------------------------------------- |
| `period`     | Time period: `24h`, `7d`, `30d`, `90d`  |
| `metric`     | Metric: `score`, `coverage`, `verdicts`  |
| `spec`       | Filter by spec path                      |
| `branch`     | Filter by branch                         |

**Response:**

```json
{
  "period": "7d",
  "metric": "score",
  "dataPoints": [
    { "timestamp": "2026-02-01", "value": 85 },
    { "timestamp": "2026-02-02", "value": 87 },
    { "timestamp": "2026-02-03", "value": 92 },
    { "timestamp": "2026-02-04", "value": 91 },
    { "timestamp": "2026-02-05", "value": 95 }
  ]
}
```

### Drift alerts

#### Get drift alerts

```
GET /api/v1/drift?status=open
```

**Query parameters:**

| Parameter    | Description                         |
| ------------ | ----------------------------------- |
| `status`     | Filter: `open`, `resolved`, `all`   |
| `severity`   | Filter: `critical`, `warning`       |
| `spec`       | Filter by spec path                 |

**Response:**

```json
{
  "alerts": [
    {
      "id": "drift-001",
      "type": "score_regression",
      "severity": "warning",
      "specPath": "specs/payment-service.isl",
      "message": "Trust score dropped from 95 to 78 in the last 3 commits",
      "previousScore": 95,
      "currentScore": 78,
      "detectedAt": "2026-02-08T10:00:00Z",
      "status": "open"
    }
  ]
}
```

## Rate limiting

The API enforces rate limiting at 120 requests per minute per client IP. Rate limit headers are included in responses:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1707400800
```

## Error responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "field": "score", "message": "Must be between 0 and 100" }
    ]
  }
}
```

| Status | Code                 | Description             |
| ------ | -------------------- | ----------------------- |
| 400    | `VALIDATION_ERROR`   | Invalid request body    |
| 401    | `UNAUTHORIZED`       | Missing authentication  |
| 404    | `NOT_FOUND`          | Resource not found      |
| 429    | `RATE_LIMITED`        | Too many requests       |
| 500    | `INTERNAL_ERROR`     | Server error            |
