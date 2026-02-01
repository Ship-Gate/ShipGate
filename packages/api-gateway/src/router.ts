/**
 * Route Handler
 * 
 * ISL-aware routing based on domain behaviors.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';

export interface Route {
  /** Route pattern */
  pattern: string;
  /** HTTP methods */
  methods: string[];
  /** Domain name */
  domain: string;
  /** Behavior name */
  behavior: string;
  /** Route metadata */
  metadata?: Record<string, unknown>;
}

export interface RouteConfig {
  /** Custom route pattern (overrides auto-generated) */
  pattern?: string;
  /** Transform function */
  transform?: (params: Record<string, string>) => Record<string, unknown>;
  /** Middleware */
  middleware?: string[];
}

export interface RouteMatch {
  /** Matched route */
  route: Route;
  /** Domain name */
  domain: string;
  /** Behavior name */
  behavior: string;
  /** Extracted parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: Record<string, string | string[]>;
}

/**
 * Route Handler
 */
export class RouteHandler {
  private routes: Route[] = [];
  private compiledRoutes: CompiledRoute[] = [];
  private customConfigs = new Map<string, RouteConfig>();

  /**
   * Register routes from a domain
   */
  registerDomain(domain: DomainDeclaration): void {
    for (const behavior of domain.behaviors) {
      const route = this.createRouteFromBehavior(domain.name.name, behavior);
      this.routes.push(route);
      this.compiledRoutes.push(this.compileRoute(route));
    }
  }

  /**
   * Create route from behavior
   */
  private createRouteFromBehavior(
    domainName: string,
    behavior: DomainDeclaration['behaviors'][0]
  ): Route {
    const behaviorName = behavior.name.name;
    const configKey = `${domainName}.${behaviorName}`;
    const config = this.customConfigs.get(configKey);

    // Determine HTTP method from behavior name
    const method = this.inferMethod(behaviorName);

    // Generate route pattern
    const pattern = config?.pattern ?? this.generatePattern(domainName, behaviorName);

    return {
      pattern,
      methods: [method],
      domain: domainName,
      behavior: behaviorName,
      metadata: {
        hasInput: !!behavior.input,
        hasOutput: !!behavior.output,
      },
    };
  }

  /**
   * Infer HTTP method from behavior name
   */
  private inferMethod(behaviorName: string): string {
    const name = behaviorName.toLowerCase();

    if (name.startsWith('create') || name.startsWith('add') || name.startsWith('register')) {
      return 'POST';
    }
    if (name.startsWith('update') || name.startsWith('modify') || name.startsWith('edit')) {
      return 'PUT';
    }
    if (name.startsWith('patch')) {
      return 'PATCH';
    }
    if (name.startsWith('delete') || name.startsWith('remove')) {
      return 'DELETE';
    }
    if (name.startsWith('get') || name.startsWith('fetch') || name.startsWith('find') || name.startsWith('list')) {
      return 'GET';
    }

    // Default to POST for actions
    return 'POST';
  }

  /**
   * Generate route pattern from domain and behavior
   */
  private generatePattern(domainName: string, behaviorName: string): string {
    const domain = this.toKebabCase(domainName);
    const resource = this.extractResource(behaviorName);
    const action = this.extractAction(behaviorName);

    // Common patterns
    if (action === 'list') {
      return `/api/${domain}/${resource}`;
    }
    if (action === 'get') {
      return `/api/${domain}/${resource}/:id`;
    }
    if (action === 'create') {
      return `/api/${domain}/${resource}`;
    }
    if (action === 'update' || action === 'delete') {
      return `/api/${domain}/${resource}/:id`;
    }

    // Default: action-based route
    return `/api/${domain}/${this.toKebabCase(behaviorName)}`;
  }

  /**
   * Extract resource name from behavior
   */
  private extractResource(behaviorName: string): string {
    // Remove common prefixes
    const prefixes = ['Create', 'Get', 'Update', 'Delete', 'List', 'Find', 'Add', 'Remove'];
    
    let resource = behaviorName;
    for (const prefix of prefixes) {
      if (resource.startsWith(prefix)) {
        resource = resource.slice(prefix.length);
        break;
      }
    }

    return this.toKebabCase(resource);
  }

  /**
   * Extract action from behavior name
   */
  private extractAction(behaviorName: string): string {
    const name = behaviorName.toLowerCase();
    
    if (name.startsWith('create') || name.startsWith('add')) return 'create';
    if (name.startsWith('get') || name.startsWith('find')) return 'get';
    if (name.startsWith('list') || name.startsWith('fetch')) return 'list';
    if (name.startsWith('update') || name.startsWith('modify')) return 'update';
    if (name.startsWith('delete') || name.startsWith('remove')) return 'delete';
    
    return 'action';
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Compile route for efficient matching
   */
  private compileRoute(route: Route): CompiledRoute {
    const paramNames: string[] = [];
    const regexParts = route.pattern.split('/').map((part) => {
      if (part.startsWith(':')) {
        paramNames.push(part.slice(1));
        return '([^/]+)';
      }
      if (part.startsWith('*')) {
        paramNames.push(part.slice(1) || 'wildcard');
        return '(.*)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });

    return {
      route,
      regex: new RegExp(`^${regexParts.join('/')}$`),
      paramNames,
    };
  }

  /**
   * Match a request to a route
   */
  match(method: string, path: string): RouteMatch | null {
    for (const compiled of this.compiledRoutes) {
      if (!compiled.route.methods.includes(method.toUpperCase())) {
        continue;
      }

      const match = path.match(compiled.regex);
      if (match) {
        const params: Record<string, string> = {};
        
        for (let i = 0; i < compiled.paramNames.length; i++) {
          params[compiled.paramNames[i]] = match[i + 1];
        }

        return {
          route: compiled.route,
          domain: compiled.route.domain,
          behavior: compiled.route.behavior,
          params,
          query: {},
        };
      }
    }

    return null;
  }

  /**
   * Add custom route configuration
   */
  configure(domain: string, behavior: string, config: RouteConfig): void {
    this.customConfigs.set(`${domain}.${behavior}`, config);
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Get routes for a domain
   */
  getDomainRoutes(domain: string): Route[] {
    return this.routes.filter((r) => r.domain === domain);
  }
}

interface CompiledRoute {
  route: Route;
  regex: RegExp;
  paramNames: string[];
}

/**
 * Create a route handler
 */
export function createRouteHandler(): RouteHandler {
  return new RouteHandler();
}
