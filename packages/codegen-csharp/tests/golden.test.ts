import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';

// ─────────────────────────────────────────────────────────────────────────────
// Golden output snapshot tests — ensures deterministic, stable output
// ─────────────────────────────────────────────────────────────────────────────

const goldenDomain = {
  name: 'Shop',
  entities: [
    {
      name: 'Product',
      description: 'A product in the catalog',
      properties: [
        { name: 'name', type: 'String', required: true, description: 'Product name' },
        { name: 'price', type: 'Decimal', required: true, description: 'Unit price' },
        { name: 'sku', type: 'String', required: true, description: 'Stock keeping unit' },
        { name: 'description', type: 'String', required: false, description: 'Product description' },
        { name: 'inStock', type: 'Boolean', required: true },
      ],
    },
  ],
};

const goldenOptions = {
  namespace: 'Shop.Generated',
  framework: 'net8.0' as const,
  webFramework: 'aspnet-core' as const,
  validation: 'data-annotations' as const,
  orm: 'entity-framework' as const,
  serialization: 'system-text-json' as const,
  nullableReferenceTypes: true,
  useRecords: false,
  useInitOnlySetters: false,
  generateXmlDocs: true,
  generateTests: true,
  testFramework: 'xunit' as const,
  outputDir: './generated',
  fileNaming: 'pascal-case' as const,
  asyncMethods: true,
  generateDI: true,
  generateOpenApiAttributes: true,
};

describe('Golden Output Snapshots', () => {
  const result = generate(goldenDomain, goldenOptions);

  it('should produce the expected file list', () => {
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toMatchSnapshot();
  });

  it('should produce stable Model output', () => {
    const model = result.files.find((f) => f.path === 'Models/Product.cs');
    expect(model).toBeDefined();
    expect(model!.content).toMatchSnapshot();
  });

  it('should produce stable CreateDto output', () => {
    const dto = result.files.find((f) => f.path === 'Dtos/CreateProductDto.cs');
    expect(dto).toBeDefined();
    expect(dto!.content).toMatchSnapshot();
  });

  it('should produce stable UpdateDto output', () => {
    const dto = result.files.find((f) => f.path === 'Dtos/UpdateProductDto.cs');
    expect(dto).toBeDefined();
    expect(dto!.content).toMatchSnapshot();
  });

  it('should produce stable ResponseDto output', () => {
    const dto = result.files.find((f) => f.path === 'Dtos/ProductResponseDto.cs');
    expect(dto).toBeDefined();
    expect(dto!.content).toMatchSnapshot();
  });

  it('should produce stable Controller output', () => {
    const ctrl = result.files.find((f) => f.path === 'Controllers/ProductController.cs');
    expect(ctrl).toBeDefined();
    expect(ctrl!.content).toMatchSnapshot();
  });

  it('should produce stable Service Interface output', () => {
    const svc = result.files.find((f) => f.path === 'Services/IProductService.cs');
    expect(svc).toBeDefined();
    expect(svc!.content).toMatchSnapshot();
  });

  it('should produce stable Service Implementation output', () => {
    const svc = result.files.find((f) => f.path === 'Services/ProductService.cs');
    expect(svc).toBeDefined();
    expect(svc!.content).toMatchSnapshot();
  });

  it('should produce stable Repository Interface output', () => {
    const repo = result.files.find((f) => f.path === 'Repositories/IProductRepository.cs');
    expect(repo).toBeDefined();
    expect(repo!.content).toMatchSnapshot();
  });

  it('should produce stable xUnit Model Tests output', () => {
    const test = result.files.find((f) => f.path === 'Tests/ProductTests.cs');
    expect(test).toBeDefined();
    expect(test!.content).toMatchSnapshot();
  });

  it('should produce stable xUnit Controller Tests output', () => {
    const test = result.files.find((f) => f.path === 'Tests/ProductControllerTests.cs');
    expect(test).toBeDefined();
    expect(test!.content).toMatchSnapshot();
  });

  it('should produce stable project file', () => {
    expect(result.projectFile).toMatchSnapshot();
  });

  it('should produce stable solution file', () => {
    expect(result.solutionFile).toMatchSnapshot();
  });

  it('should produce stable test project file', () => {
    const testProj = result.files.find((f) => f.path === 'Tests/Tests.csproj');
    expect(testProj).toBeDefined();
    expect(testProj!.content).toMatchSnapshot();
  });
});
