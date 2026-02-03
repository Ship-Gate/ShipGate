/**
 * Example: Safe Landing Page Blueprint
 * 
 * This ISL spec demonstrates the UI blueprint feature for generating
 * safe, accessible Next.js landing pages.
 * 
 * Run: isl generate examples/landing-page.isl --target nextjs
 */

domain ProductLanding {
  version: "1.0.0"

  // UI Blueprint for a SaaS landing page
  ui_blueprint LandingPage {
    
    // Design tokens for consistent styling
    tokens {
      primaryColor: color "#6366f1"
      secondaryColor: color "#8b5cf6"
      textColor: color "#1f2937"
      backgroundColor: color "#ffffff"
      spacing_sm: spacing "8px"
      spacing_md: spacing "16px"
      spacing_lg: spacing "32px"
      heading_font: typography "Inter, system-ui, sans-serif"
      body_font: typography "Inter, system-ui, sans-serif"
    }

    // Safety constraints enforced during generation
    constraints {
      a11y: images_have_alt
      a11y: buttons_have_labels
      a11y: heading_hierarchy
      seo: has_h1_heading
      seo: single_h1
      security: no_inline_secrets
      security: safe_urls
      perf: lazy_load_images
    }

    // Hero section
    section hero: hero {
      layout: flex {
        gap: "32px"
      }
      
      heading {
        level: "1"
        content: "Build Faster with Intent-Driven Development"
      }
      
      text {
        content: "Transform your ideas into production-ready code with ISL. Specify what you want, let AI handle the how."
      }
      
      container {
        button {
          label: "Get Started Free"
          href: "/signup"
        }
        
        link {
          content: "View Documentation"
          href: "/docs"
        }
      }
      
      image {
        src: "/images/hero-illustration.svg"
        alt: "Illustration showing code generation workflow from intent to production"
      }
    }

    // Features section
    section features: features {
      layout: grid {
        columns: 3
        gap: "24px"
      }
      
      heading {
        level: "2"
        content: "Why Teams Choose ISL"
      }
      
      container {
        heading {
          level: "3"
          content: "Intent-First Design"
        }
        text {
          content: "Describe what your system should do, not how. ISL captures business logic as executable specifications."
        }
      }
      
      container {
        heading {
          level: "3"
          content: "AI-Powered Generation"
        }
        text {
          content: "Generate type-safe implementations from your specs. Works with TypeScript, Python, Rust, and more."
        }
      }
      
      container {
        heading {
          level: "3"
          content: "Built-in Safety"
        }
        text {
          content: "Automatic verification ensures your code matches your intent. No more specification drift."
        }
      }
    }

    // Social proof section
    section testimonials: testimonials {
      layout: grid {
        columns: 2
        gap: "16px"
      }
      
      heading {
        level: "2"
        content: "Trusted by Engineering Teams"
      }
      
      container {
        text {
          content: "ISL reduced our specification bugs by 80%. The generated code just works."
        }
        text {
          content: "— Sarah Chen, VP Engineering at TechCorp"
        }
      }
      
      container {
        text {
          content: "We shipped 3x faster after adopting ISL. Our contracts are now the source of truth."
        }
        text {
          content: "— Marcus Johnson, CTO at StartupXYZ"
        }
      }
    }

    // Call to action
    section signup: cta {
      layout: stack {
        gap: "24px"
      }
      
      heading {
        level: "2"
        content: "Start Building with Intent"
      }
      
      text {
        content: "Join thousands of developers who ship faster with ISL. Free tier includes 1000 generations per month."
      }
      
      form {
        action: "/api/signup"
        method: "POST"
        submitLabel: "Create Free Account"
        
        text {
          name: "email"
          label: "Email Address"
          type: "email"
        }
      }
    }

    // Footer
    section footer: footer {
      layout: flex {
        gap: "48px"
      }
      
      container {
        heading {
          level: "4"
          content: "Product"
        }
        link {
          content: "Features"
          href: "/features"
        }
        link {
          content: "Pricing"
          href: "/pricing"
        }
        link {
          content: "Documentation"
          href: "/docs"
        }
      }
      
      container {
        heading {
          level: "4"
          content: "Company"
        }
        link {
          content: "About"
          href: "/about"
        }
        link {
          content: "Blog"
          href: "/blog"
        }
        link {
          content: "Careers"
          href: "/careers"
        }
      }
      
      container {
        heading {
          level: "4"
          content: "Legal"
        }
        link {
          content: "Privacy Policy"
          href: "/privacy"
        }
        link {
          content: "Terms of Service"
          href: "/terms"
        }
      }
      
      text {
        content: "© 2026 ISL Lang. All rights reserved."
      }
    }
  }
}
