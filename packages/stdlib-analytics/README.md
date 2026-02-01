# @intentos/stdlib-analytics

Analytics event tracking standard library for ISL (Intent Specification Language).

## Features

- **Multi-provider support**: Segment, Amplitude, Mixpanel, PostHog
- **Type-safe API**: Full TypeScript support with generated types
- **Framework integrations**: Express middleware, Next.js integration
- **ISL-verified**: Behavioral contracts ensure correct implementation
- **Non-blocking**: Async event queue with automatic batching
- **Privacy-aware**: PII markers and GDPR/CCPA compliance support

## Installation

```bash
npm install @intentos/stdlib-analytics
```

## Quick Start

```typescript
import { createAnalytics, SegmentProvider } from '@intentos/stdlib-analytics';

// Create analytics client
const analytics = createAnalytics(
  new SegmentProvider({ writeKey: 'YOUR_WRITE_KEY' }),
  { debug: true }
);

// Track an event
await analytics.track({
  event: 'Button_Clicked',
  userId: 'user_123',
  properties: {
    button_id: 'signup_cta',
    page: '/landing',
  },
});

// Identify a user
await analytics.identify({
  userId: 'user_123',
  traits: {
    email: 'user@example.com',
    name: 'John Doe',
    plan: 'premium',
  },
});

// Track a page view
await analytics.page({
  userId: 'user_123',
  name: 'Product Page',
  context: {
    page: {
      path: '/products/widget',
      url: 'https://example.com/products/widget',
    },
  },
});
```

## Providers

### Segment

```typescript
import { SegmentProvider } from '@intentos/stdlib-analytics/providers/segment';

const provider = new SegmentProvider({
  writeKey: 'YOUR_SEGMENT_WRITE_KEY',
});
```

### Amplitude

```typescript
import { AmplitudeProvider } from '@intentos/stdlib-analytics/providers/amplitude';

const provider = new AmplitudeProvider({
  writeKey: 'YOUR_AMPLITUDE_API_KEY',
  euDataResidency: true, // Optional: EU data center
});
```

### Mixpanel

```typescript
import { MixpanelProvider } from '@intentos/stdlib-analytics/providers/mixpanel';

const provider = new MixpanelProvider({
  writeKey: 'YOUR_MIXPANEL_TOKEN',
});
```

### PostHog

```typescript
import { PostHogProvider } from '@intentos/stdlib-analytics/providers/posthog';

const provider = new PostHogProvider({
  writeKey: 'YOUR_POSTHOG_API_KEY',
  host: 'https://app.posthog.com', // Or self-hosted URL
});
```

## Framework Integrations

### Express

```typescript
import express from 'express';
import { createAnalytics, SegmentProvider } from '@intentos/stdlib-analytics';
import { createExpressMiddleware } from '@intentos/stdlib-analytics/middleware/express';

const app = express();

const analytics = createAnalytics(
  new SegmentProvider({ writeKey: 'YOUR_KEY' })
);

app.use(createExpressMiddleware({
  analytics,
  trackPageViews: true,
  getUserId: (req) => req.user?.id,
}));

// Use in routes
app.post('/purchase', async (req, res) => {
  await req.analytics.track('Purchase_Completed', {
    order_id: req.body.orderId,
    revenue: req.body.total,
  });
  res.json({ success: true });
});
```

### Next.js

```typescript
// app/layout.tsx
import { getAnalyticsScriptTag } from '@intentos/stdlib-analytics/middleware/nextjs';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getAnalyticsScriptTag({
              provider: 'segment',
              writeKey: process.env.SEGMENT_WRITE_KEY!,
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```typescript
// Server-side tracking in API routes
import { createServerAnalytics } from '@intentos/stdlib-analytics/middleware/nextjs';

export async function POST(request: NextRequest) {
  const analytics = createServerAnalytics(analyticsClient, request, userId);
  
  await analytics.track('Form_Submitted', {
    form_id: 'contact',
  });
  
  return Response.json({ success: true });
}
```

## Standard Events

Use standard event names for consistent tracking:

```typescript
import { StandardEvents } from '@intentos/stdlib-analytics';

// E-commerce
analytics.track({ event: StandardEvents.ORDER_COMPLETED, ... });
analytics.track({ event: StandardEvents.PRODUCT_VIEWED, ... });
analytics.track({ event: StandardEvents.CART_VIEWED, ... });

// User Lifecycle
analytics.track({ event: StandardEvents.SIGNED_UP, ... });
analytics.track({ event: StandardEvents.SIGNED_IN, ... });

// Engagement
analytics.track({ event: StandardEvents.BUTTON_CLICKED, ... });
analytics.track({ event: StandardEvents.FORM_SUBMITTED, ... });
```

## Configuration

```typescript
const analytics = createAnalytics(provider, {
  // Flush events every 10 seconds
  flushInterval: 10000,
  
  // Flush when queue reaches 20 events
  flushAt: 20,
  
  // Maximum queue size
  maxQueueSize: 1000,
  
  // Retry failed events up to 3 times
  retryCount: 3,
  
  // Enable debug logging
  debug: true,
});
```

## ISL Specification

This library implements the ISL Analytics domain specification:

```isl
behavior Track {
  input {
    event: EventName
    user_id: UserId?
    anonymous_id: AnonymousId?
    properties: Map<String, Any>?
  }
  
  preconditions {
    input.user_id != null or input.anonymous_id != null
    input.event.matches("^[A-Za-z][A-Za-z0-9_]*$")
  }
  
  temporal {
    response within 50.ms (p99)  // Non-blocking
  }
  
  invariants {
    async_delivery
    at_least_once_delivery
  }
}
```

## License

MIT
