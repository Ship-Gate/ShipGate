# Page Behavior
# Track page views

import { Analytics } from "../domain.isl"

behavior Page {
  description: "Track a page view event"
  
  actors {
    Browser {
      for: client_side_tracking
    }
    Server {
      for: server_side_rendering
    }
  }
  
  input {
    user_id: UserId?
    anonymous_id: AnonymousId?
    name: String?          # Page name
    category: String?      # Page category
    properties: Map<String, Any>?
    context: Context       # Required, must include page context
  }
  
  output {
    success: {
      id: TrackingId
    }
    
    errors {
      MISSING_IDENTIFIER {
        when: "Neither user_id nor anonymous_id provided"
        retriable: false
      }
      MISSING_PAGE_CONTEXT {
        when: "context.page is required for page views"
        retriable: false
      }
    }
  }
  
  preconditions {
    # Must have at least one identifier
    input.user_id != null or input.anonymous_id != null
    
    # Must have page context
    input.context != null
    input.context.page != null
    input.context.page.path != null
    input.context.page.url != null
  }
  
  postconditions {
    success implies {
      - PageEvent.exists(result.id)
      - PageEvent.lookup(result.id).context.page == input.context.page
    }
  }
  
  invariants {
    - page views auto-capture URL, path, title
    - referrer captured if available
    - campaign parameters (UTM) captured
  }
  
  temporal {
    - within 5ms (p99): returns to caller
    - eventually within 30s: event sent to provider
  }
}

# ============================================
# Page Scenarios
# ============================================

scenarios Page {
  scenario "track page view" {
    when {
      result = Page(
        user_id: "user_123",
        name: "Product Page",
        category: "Products",
        properties: {
          "product_id": "prod_456"
        },
        context: {
          page: {
            path: "/products/widget",
            url: "https://example.com/products/widget",
            title: "Widget - Example Store",
            referrer: "https://google.com/search?q=widget"
          },
          campaign: {
            source: "google",
            medium: "cpc",
            name: "widget_campaign"
          }
        }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "track anonymous page view" {
    when {
      result = Page(
        anonymous_id: "anon_visitor",
        context: {
          page: {
            path: "/",
            url: "https://example.com/",
            title: "Home - Example"
          },
          device: {
            type: "mobile",
            os_name: "iOS",
            browser: "Safari"
          }
        }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "reject missing page context" {
    when {
      result = Page(
        user_id: "user_123",
        context: {
          # Missing page context
          device: { type: "desktop" }
        }
      )
    }
    
    then {
      result is error MISSING_PAGE_CONTEXT
    }
  }
}
