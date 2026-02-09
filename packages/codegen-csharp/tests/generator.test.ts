import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import type { CSharpGeneratorOptions } from '../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const sampleDomain = {
  name: 'Auth',
  entities: [
    {
      name: 'User',
      description: 'A user account in the system',
      properties: [
        { name: 'username', type: 'String', required: true, description: 'Login username' },
        { name: 'email', type: 'Email', required: true, description: 'User email address' },
        { name: 'age', type: 'Int', required: false, description: 'User age' },
        { name: 'isActive', type: 'Boolean', required: true },
      ],
    },
    {
      name: 'Role',
      description: 'A user role',
      properties: [
        { name: 'name', type: 'String', required: true, description: 'Role name' },
        { name: 'permissions', type: 'String[]', required: false, description: 'Role permissions' },
      ],
    },
  ],
};

const minimalOptions: Partial<CSharpGeneratorOptions> = {
  namespace: 'Auth.Generated',
  framework: 'net8.0',
  webFramework: 'aspnet-core',
  validation: 'data-annotations',
  orm: 'entity-framework',
  generateTests: true,
  testFramework: 'xunit',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('C# Code Generator', () => {
  describe('generate()', () => {
    it('should return a GenerationResult with files', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.projectFile).toBeDefined();
      expect(result.solutionFile).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should generate model files for each entity', () => {
      const result = generate(sampleDomain, minimalOptions);
      const modelFiles = result.files.filter((f) => f.path.startsWith('Models/'));

      expect(modelFiles.length).toBe(2);
      expect(modelFiles.some((f) => f.path === 'Models/User.cs')).toBe(true);
      expect(modelFiles.some((f) => f.path === 'Models/Role.cs')).toBe(true);
    });

    it('should generate DTO files for each entity', () => {
      const result = generate(sampleDomain, minimalOptions);
      const dtoFiles = result.files.filter((f) => f.path.startsWith('Dtos/'));

      expect(dtoFiles.length).toBe(6); // 3 DTOs per entity × 2 entities
      expect(dtoFiles.some((f) => f.path === 'Dtos/CreateUserDto.cs')).toBe(true);
      expect(dtoFiles.some((f) => f.path === 'Dtos/UpdateUserDto.cs')).toBe(true);
      expect(dtoFiles.some((f) => f.path === 'Dtos/UserResponseDto.cs')).toBe(true);
    });

    it('should generate controller files for aspnet-core', () => {
      const result = generate(sampleDomain, minimalOptions);
      const controllerFiles = result.files.filter((f) => f.path.startsWith('Controllers/'));

      expect(controllerFiles.length).toBe(2);
      expect(controllerFiles.some((f) => f.path === 'Controllers/UserController.cs')).toBe(true);
      expect(controllerFiles.some((f) => f.path === 'Controllers/RoleController.cs')).toBe(true);
    });

    it('should generate service interfaces and implementations', () => {
      const result = generate(sampleDomain, minimalOptions);
      const serviceFiles = result.files.filter((f) => f.path.startsWith('Services/'));

      expect(serviceFiles.length).toBe(4); // interface + impl per entity
      expect(serviceFiles.some((f) => f.path === 'Services/IUserService.cs')).toBe(true);
      expect(serviceFiles.some((f) => f.path === 'Services/UserService.cs')).toBe(true);
    });

    it('should generate test files when generateTests is true', () => {
      const result = generate(sampleDomain, minimalOptions);
      const testFiles = result.files.filter((f) => f.type === 'test');

      expect(testFiles.length).toBeGreaterThan(0);
      expect(testFiles.some((f) => f.path === 'Tests/UserTests.cs')).toBe(true);
      expect(testFiles.some((f) => f.path === 'Tests/RoleTests.cs')).toBe(true);
    });

    it('should generate controller tests for aspnet-core', () => {
      const result = generate(sampleDomain, minimalOptions);
      const testFiles = result.files.filter((f) => f.type === 'test');

      expect(testFiles.some((f) => f.path === 'Tests/UserControllerTests.cs')).toBe(true);
      expect(testFiles.some((f) => f.path === 'Tests/RoleControllerTests.cs')).toBe(true);
    });

    it('should NOT generate test files when generateTests is false', () => {
      const result = generate(sampleDomain, { ...minimalOptions, generateTests: false });
      const testFiles = result.files.filter((f) => f.type === 'test');

      expect(testFiles.length).toBe(0);
    });

    it('should generate repository files when orm is not none', () => {
      const result = generate(sampleDomain, minimalOptions);
      const repoFiles = result.files.filter((f) => f.path.startsWith('Repositories/'));

      expect(repoFiles.length).toBeGreaterThan(0);
      expect(repoFiles.some((f) => f.path === 'Repositories/IUserRepository.cs')).toBe(true);
      expect(repoFiles.some((f) => f.path === 'Repositories/UserRepository.cs')).toBe(true);
    });

    it('should NOT generate repository files when orm is none', () => {
      const result = generate(sampleDomain, { ...minimalOptions, orm: 'none' });
      const repoFiles = result.files.filter((f) => f.path.startsWith('Repositories/'));

      expect(repoFiles.length).toBe(0);
    });

    it('should generate minimal API endpoints when webFramework is aspnet-minimal', () => {
      const result = generate(sampleDomain, { ...minimalOptions, webFramework: 'aspnet-minimal' });
      const endpointFiles = result.files.filter((f) => f.path.startsWith('Endpoints/'));

      expect(endpointFiles.length).toBe(2);
      expect(endpointFiles.some((f) => f.path === 'Endpoints/UserEndpoints.cs')).toBe(true);
    });

    it('should track statistics correctly', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.statistics.models).toBeGreaterThan(0);
      expect(result.statistics.services).toBeGreaterThan(0);
      expect(result.statistics.controllers).toBeGreaterThan(0);
      expect(result.statistics.tests).toBeGreaterThan(0);
      expect(result.statistics.totalLines).toBeGreaterThan(0);
    });
  });

  describe('Model content', () => {
    it('should include namespace declaration', () => {
      const result = generate(sampleDomain, minimalOptions);
      const userModel = result.files.find((f) => f.path === 'Models/User.cs');

      expect(userModel).toBeDefined();
      expect(userModel!.content).toContain('namespace Auth.Generated');
    });

    it('should include auto-generated Id property', () => {
      const result = generate(sampleDomain, minimalOptions);
      const userModel = result.files.find((f) => f.path === 'Models/User.cs');

      expect(userModel!.content).toContain('Guid');
      expect(userModel!.content).toContain('Id');
    });

    it('should include entity properties with correct C# types', () => {
      const result = generate(sampleDomain, minimalOptions);
      const userModel = result.files.find((f) => f.path === 'Models/User.cs');

      expect(userModel!.content).toContain('string');
      expect(userModel!.content).toContain('Username');
      expect(userModel!.content).toContain('bool');
    });

    it('should include CreatedAt and UpdatedAt timestamps', () => {
      const result = generate(sampleDomain, minimalOptions);
      const userModel = result.files.find((f) => f.path === 'Models/User.cs');

      expect(userModel!.content).toContain('CreatedAt');
      expect(userModel!.content).toContain('UpdatedAt');
    });
  });

  describe('DTO content', () => {
    it('should exclude Id, CreatedAt, UpdatedAt from CreateDto', () => {
      const result = generate(sampleDomain, minimalOptions);
      const createDto = result.files.find((f) => f.path === 'Dtos/CreateUserDto.cs');

      expect(createDto).toBeDefined();
      expect(createDto!.content).not.toMatch(/\bId\b.*get/);
      expect(createDto!.content).not.toContain('CreatedAt');
      expect(createDto!.content).not.toContain('UpdatedAt');
      expect(createDto!.content).toContain('Username');
    });

    it('should have correct namespace for DTOs', () => {
      const result = generate(sampleDomain, minimalOptions);
      const createDto = result.files.find((f) => f.path === 'Dtos/CreateUserDto.cs');

      expect(createDto!.content).toContain('namespace Auth.Generated.Dtos');
    });
  });

  describe('Controller content', () => {
    it('should include ApiController attribute', () => {
      const result = generate(sampleDomain, minimalOptions);
      const ctrl = result.files.find((f) => f.path === 'Controllers/UserController.cs');

      expect(ctrl).toBeDefined();
      expect(ctrl!.content).toContain('[ApiController]');
    });

    it('should include route attribute', () => {
      const result = generate(sampleDomain, minimalOptions);
      const ctrl = result.files.find((f) => f.path === 'Controllers/UserController.cs');

      expect(ctrl!.content).toContain('[Route("api/[controller]")]');
    });

    it('should inject service via constructor', () => {
      const result = generate(sampleDomain, minimalOptions);
      const ctrl = result.files.find((f) => f.path === 'Controllers/UserController.cs');

      expect(ctrl!.content).toContain('IUserService');
      expect(ctrl!.content).toContain('_service');
    });

    it('should include CRUD endpoints', () => {
      const result = generate(sampleDomain, minimalOptions);
      const ctrl = result.files.find((f) => f.path === 'Controllers/UserController.cs');

      expect(ctrl!.content).toContain('HttpGet');
      expect(ctrl!.content).toContain('HttpPost');
      expect(ctrl!.content).toContain('HttpPut');
      expect(ctrl!.content).toContain('HttpDelete');
    });
  });

  describe('xUnit test content', () => {
    it('should include xUnit using statement', () => {
      const result = generate(sampleDomain, minimalOptions);
      const test = result.files.find((f) => f.path === 'Tests/UserTests.cs');

      expect(test).toBeDefined();
      expect(test!.content).toContain('using Xunit;');
    });

    it('should include [Fact] attributes', () => {
      const result = generate(sampleDomain, minimalOptions);
      const test = result.files.find((f) => f.path === 'Tests/UserTests.cs');

      expect(test!.content).toContain('[Fact]');
    });

    it('should include creation test', () => {
      const result = generate(sampleDomain, minimalOptions);
      const test = result.files.find((f) => f.path === 'Tests/UserTests.cs');

      expect(test!.content).toContain('User_Can_Be_Created');
    });

    it('should include controller test with Moq', () => {
      const result = generate(sampleDomain, minimalOptions);
      const test = result.files.find((f) => f.path === 'Tests/UserControllerTests.cs');

      expect(test).toBeDefined();
      expect(test!.content).toContain('using Moq;');
      expect(test!.content).toContain('Mock<IUserService>');
    });
  });

  describe('Project file', () => {
    it('should include target framework', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.projectFile).toContain('<TargetFramework>net8.0</TargetFramework>');
    });

    it('should include nullable enable', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.projectFile).toContain('<Nullable>enable</Nullable>');
    });

    it('should include EF packages when orm is entity-framework', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.projectFile).toContain('Microsoft.EntityFrameworkCore');
    });
  });

  describe('Solution file', () => {
    it('should include solution file format header', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.solutionFile).toBeDefined();
      expect(result.solutionFile).toContain('Microsoft Visual Studio Solution File');
    });

    it('should include both src and test projects', () => {
      const result = generate(sampleDomain, minimalOptions);

      expect(result.solutionFile).toContain('Auth.Generated');
      expect(result.solutionFile).toContain('Auth.Generated.Tests');
    });
  });

  describe('Type mapping', () => {
    it('should map ISL String to C# string', () => {
      const result = generate(sampleDomain, minimalOptions);
      const userModel = result.files.find((f) => f.path === 'Models/User.cs');

      expect(userModel!.content).toContain('string');
    });

    it('should map ISL array types to List<T>', () => {
      const result = generate(sampleDomain, minimalOptions);
      const roleModel = result.files.find((f) => f.path === 'Models/Role.cs');

      expect(roleModel!.content).toContain('List<string>');
    });
  });

  describe('Deterministic output', () => {
    it('should produce identical output for identical inputs', () => {
      const result1 = generate(sampleDomain, minimalOptions);
      const result2 = generate(sampleDomain, minimalOptions);

      expect(result1.files.length).toBe(result2.files.length);

      for (let i = 0; i < result1.files.length; i++) {
        expect(result1.files[i].path).toBe(result2.files[i].path);
        expect(result1.files[i].content).toBe(result2.files[i].content);
      }

      expect(result1.projectFile).toBe(result2.projectFile);
      expect(result1.solutionFile).toBe(result2.solutionFile);
    });
  });
});
