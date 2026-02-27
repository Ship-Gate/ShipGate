/**
 * Error extractor tests
 */

import { describe, it, expect } from 'vitest';
import { ErrorExtractor } from '../src/extractor.js';

describe('ErrorExtractor', () => {
  const extractor = new ErrorExtractor();

  describe('extractFromSource', () => {
    it('should extract error from ISL source', () => {
      const source = `
domain Auth {
  error DUPLICATE_EMAIL {
    code: "AUTH_001"
    httpStatus: 409
    message: "Email already exists"
    retriable: false
    severity: error
    causes: ["User registration with existing email", "Admin creating duplicate user"]
    resolutions: ["Use different email", "Reset password for existing account"]
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors).toHaveLength(1);
      expect(errors[0].id).toBe('DUPLICATE_EMAIL');
      expect(errors[0].code).toBe('AUTH_001');
      expect(errors[0].httpStatus).toBe(409);
      expect(errors[0].message).toBe('Email already exists');
      expect(errors[0].retriable).toBe(false);
      expect(errors[0].domain).toBe('Auth');
      expect(errors[0].causes).toHaveLength(2);
      expect(errors[0].resolutions).toHaveLength(2);
    });

    it('should extract multiple errors from domain', () => {
      const source = `
domain Auth {
  error DUPLICATE_EMAIL {
    code: "AUTH_001"
    httpStatus: 409
    message: "Email already exists"
  }
  
  error RATE_LIMITED {
    code: "AUTH_002"
    httpStatus: 429
    message: "Too many requests"
    retriable: true
    retryAfter: 60
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors).toHaveLength(2);
      expect(errors[0].id).toBe('DUPLICATE_EMAIL');
      expect(errors[1].id).toBe('RATE_LIMITED');
      expect(errors[1].retryAfter).toBe(60);
    });

    it('should infer HTTP status from error name', () => {
      const source = `
domain Auth {
  error USER_NOT_FOUND {
    message: "User not found"
  }
  
  error UNAUTHORIZED {
    message: "Authentication required"
  }
  
  error ACCESS_DENIED {
    message: "Access denied"
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors[0].httpStatus).toBe(404);
      expect(errors[1].httpStatus).toBe(401);
      expect(errors[2].httpStatus).toBe(403);
    });

    it('should infer retriable from HTTP status', () => {
      const source = `
domain System {
  error SERVER_ERROR {
    httpStatus: 500
    message: "Internal error"
  }
  
  error VALIDATION_ERROR {
    httpStatus: 400
    message: "Validation failed"
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors[0].retriable).toBe(true);
      expect(errors[1].retriable).toBe(false);
    });

    it('should generate code if not specified', () => {
      const source = `
domain User {
  error PROFILE_NOT_FOUND {
    httpStatus: 404
    message: "Profile not found"
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors[0].code).toMatch(/^USER_\d{3}$/);
    });

    it('should handle global errors without domain', () => {
      const source = `
error INTERNAL_ERROR {
  code: "SYS_001"
  httpStatus: 500
  message: "Internal server error"
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors).toHaveLength(1);
      expect(errors[0].domain).toBe('global');
    });

    it('should parse tags', () => {
      const source = `
domain Auth {
  error MFA_REQUIRED {
    code: "AUTH_003"
    httpStatus: 428
    message: "MFA required"
    tags: ["security", "authentication", "mfa"]
  }
}
`;

      const errors = extractor.extractFromSource(source, 'test.isl');

      expect(errors[0].tags).toEqual(['security', 'authentication', 'mfa']);
    });
  });
});
