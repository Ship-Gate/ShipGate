// ============================================================================
// C# xUnit Test Templates
// ============================================================================

import type { CSharpClassInfo, CSharpGeneratorOptions } from '../types.js';
import { generateUsings } from './model.js';

/**
 * Generate xUnit test class for a model
 */
export function generateModelTests(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const testClassName = `${model.name}Tests`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Xunit',
    'System',
    model.namespace,
    `${model.namespace}.Dtos`,
  ];
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    usings.push('FluentValidation.TestHelper');
    usings.push(`${model.namespace}.Validators`);
  }
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Tests;\n`);

  // Test class
  parts.push(`public class ${testClassName}`);
  parts.push('{');

  // Test: model can be instantiated
  parts.push('    [Fact]');
  parts.push(`    public void ${model.name}_Can_Be_Created()`);
  parts.push('    {');
  parts.push(`        // Arrange & Act`);

  if (options.useRecords) {
    const requiredProps = model.properties.filter((p) => p.isRequired);
    const ctorArgs = requiredProps
      .map((p) => `${p.name}: ${getDefaultTestValue(p.type.name)}`)
      .join(', ');
    parts.push(`        var entity = new ${model.name}(${ctorArgs});`);
  } else {
    parts.push(`        var entity = new ${model.name}`);
    parts.push('        {');
    for (const prop of model.properties.filter((p) => p.isRequired)) {
      parts.push(`            ${prop.name} = ${getDefaultTestValue(prop.type.name)},`);
    }
    parts.push('        };');
  }

  parts.push('');
  parts.push('        // Assert');
  parts.push('        Assert.NotNull(entity);');
  parts.push('    }');
  parts.push('');

  // Test: required properties are set
  const requiredProps = model.properties.filter((p) => p.isRequired);
  if (requiredProps.length > 0) {
    parts.push('    [Fact]');
    parts.push(`    public void ${model.name}_Required_Properties_Are_Set()`);
    parts.push('    {');
    parts.push('        // Arrange');

    if (options.useRecords) {
      const ctorArgs = requiredProps
        .map((p) => `${p.name}: ${getDefaultTestValue(p.type.name)}`)
        .join(', ');
      parts.push(`        var entity = new ${model.name}(${ctorArgs});`);
    } else {
      parts.push(`        var entity = new ${model.name}`);
      parts.push('        {');
      for (const prop of requiredProps) {
        parts.push(`            ${prop.name} = ${getDefaultTestValue(prop.type.name)},`);
      }
      parts.push('        };');
    }

    parts.push('');
    parts.push('        // Assert');
    for (const prop of requiredProps) {
      const assertion = getAssertionForType(prop.type.name, prop.name);
      parts.push(`        ${assertion}`);
    }
    parts.push('    }');
    parts.push('');
  }

  // Test: Id is a valid Guid
  const hasId = model.properties.some((p) => p.name === 'Id');
  if (hasId) {
    parts.push('    [Fact]');
    parts.push(`    public void ${model.name}_Id_Should_Be_Valid_Guid()`);
    parts.push('    {');
    parts.push('        // Arrange');
    parts.push('        var expectedId = Guid.NewGuid();');
    parts.push('');

    if (options.useRecords) {
      const ctorArgs = requiredProps
        .map((p) => p.name === 'Id' ? 'Id: expectedId' : `${p.name}: ${getDefaultTestValue(p.type.name)}`)
        .join(', ');
      parts.push(`        var entity = new ${model.name}(${ctorArgs});`);
    } else {
      parts.push(`        var entity = new ${model.name}`);
      parts.push('        {');
      for (const prop of requiredProps) {
        if (prop.name === 'Id') {
          parts.push('            Id = expectedId,');
        } else {
          parts.push(`            ${prop.name} = ${getDefaultTestValue(prop.type.name)},`);
        }
      }
      parts.push('        };');
    }

    parts.push('');
    parts.push('        // Assert');
    parts.push('        Assert.Equal(expectedId, entity.Id);');
    parts.push('        Assert.NotEqual(Guid.Empty, entity.Id);');
    parts.push('    }');
    parts.push('');
  }

  // Validator tests if FluentValidation is enabled
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    parts.push(generateValidatorTests(model, options));
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate xUnit test class for a controller
 */
export function generateControllerTests(
  model: CSharpClassInfo,
  _options: CSharpGeneratorOptions
): string {
  const testClassName = `${model.name}ControllerTests`;
  const controllerName = `${model.name}Controller`;
  const serviceName = `I${model.name}Service`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Xunit',
    'Moq',
    'System',
    'System.Collections.Generic',
    'System.Threading',
    'System.Threading.Tasks',
    'Microsoft.AspNetCore.Mvc',
    model.namespace,
    `${model.namespace}.Controllers`,
    `${model.namespace}.Services`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Tests;\n`);

  // Test class
  parts.push(`public class ${testClassName}`);
  parts.push('{');
  parts.push(`    private readonly Mock<${serviceName}> _mockService;`);
  parts.push(`    private readonly ${controllerName} _controller;\n`);

  // Constructor
  parts.push(`    public ${testClassName}()`);
  parts.push('    {');
  parts.push(`        _mockService = new Mock<${serviceName}>();`);
  parts.push(`        _controller = new ${controllerName}(_mockService.Object);`);
  parts.push('    }\n');

  // Test: GetAll returns OK
  parts.push('    [Fact]');
  parts.push(`    public async Task GetAll_ReturnsOkResult()`);
  parts.push('    {');
  parts.push('        // Arrange');
  parts.push(`        var items = new List<${model.name}>();`);
  parts.push(`        _mockService.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>()))`);
  parts.push('            .ReturnsAsync(items);');
  parts.push('');
  parts.push('        // Act');
  parts.push('        var result = await _controller.GetAll(CancellationToken.None);');
  parts.push('');
  parts.push('        // Assert');
  parts.push('        Assert.IsType<OkObjectResult>(result.Result);');
  parts.push('    }\n');

  // Test: GetById returns NotFound when missing
  parts.push('    [Fact]');
  parts.push(`    public async Task GetById_WithInvalidId_ReturnsNotFound()`);
  parts.push('    {');
  parts.push('        // Arrange');
  parts.push('        var id = Guid.NewGuid();');
  parts.push(`        _mockService.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>()))`);
  parts.push(`            .ReturnsAsync((${model.name}?)null);`);
  parts.push('');
  parts.push('        // Act');
  parts.push('        var result = await _controller.GetById(id, CancellationToken.None);');
  parts.push('');
  parts.push('        // Assert');
  parts.push('        Assert.IsType<NotFoundResult>(result.Result);');
  parts.push('    }\n');

  // Test: Delete returns NoContent on success
  parts.push('    [Fact]');
  parts.push('    public async Task Delete_WithValidId_ReturnsNoContent()');
  parts.push('    {');
  parts.push('        // Arrange');
  parts.push('        var id = Guid.NewGuid();');
  parts.push('        _mockService.Setup(s => s.DeleteAsync(id, It.IsAny<CancellationToken>()))');
  parts.push('            .ReturnsAsync(true);');
  parts.push('');
  parts.push('        // Act');
  parts.push('        var result = await _controller.Delete(id, CancellationToken.None);');
  parts.push('');
  parts.push('        // Assert');
  parts.push('        Assert.IsType<NoContentResult>(result.Result);');
  parts.push('    }');

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate xUnit test project file (.csproj)
 */
export function generateTestProjectFile(options: CSharpGeneratorOptions): string {
  return `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>${options.framework}</TargetFramework>
    <Nullable>${options.nullableReferenceTypes ? 'enable' : 'disable'}</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
    <RootNamespace>${options.namespace}.Tests</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xunit" Version="2.6.6" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.6">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Moq" Version="4.20.70" />
    <PackageReference Include="FluentAssertions" Version="6.12.0" />
    <PackageReference Include="coverlet.collector" Version="6.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\\src\\${options.namespace}.csproj" />
  </ItemGroup>

</Project>`;
}

/**
 * Generate solution file
 */
export function generateSolutionFile(options: CSharpGeneratorOptions): string {
  const ns = options.namespace;
  // Use fixed GUIDs for deterministic output
  const srcGuid = '00000000-0000-0000-0000-000000000002';
  const testGuid = '00000000-0000-0000-0000-000000000003';
  const csharpTypeGuid = 'FAE04EC0-301F-11D3-BF4B-00C04F79EFBC';

  return `
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.0.31903.59
MinimumVisualStudioVersion = 10.0.40219.1
Project("{${csharpTypeGuid}}") = "${ns}", "src\\${ns}.csproj", "{${srcGuid}}"
EndProject
Project("{${csharpTypeGuid}}") = "${ns}.Tests", "tests\\${ns}.Tests.csproj", "{${testGuid}}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
\t\tDebug|Any CPU = Debug|Any CPU
\t\tRelease|Any CPU = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(ProjectConfigurationPlatforms) = postSolution
\t\t{${srcGuid}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
\t\t{${srcGuid}}.Debug|Any CPU.Build.0 = Debug|Any CPU
\t\t{${srcGuid}}.Release|Any CPU.ActiveCfg = Release|Any CPU
\t\t{${srcGuid}}.Release|Any CPU.Build.0 = Release|Any CPU
\t\t{${testGuid}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
\t\t{${testGuid}}.Debug|Any CPU.Build.0 = Debug|Any CPU
\t\t{${testGuid}}.Release|Any CPU.ActiveCfg = Release|Any CPU
\t\t{${testGuid}}.Release|Any CPU.Build.0 = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(SolutionProperties) = preSolution
\t\tHideSolutionNode = FALSE
\tEndGlobalSection
EndGlobal`.trimStart();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate FluentValidation test methods
 */
function generateValidatorTests(
  model: CSharpClassInfo,
  _options: CSharpGeneratorOptions,
): string {
  const lines: string[] = [];
  const validatorName = `${model.name}Validator`;

  lines.push(`    private readonly ${validatorName} _validator = new();\n`);

  // Required property tests
  for (const prop of model.properties.filter((p) => p.isRequired)) {
    lines.push('    [Fact]');
    lines.push(`    public void Should_Have_Error_When_${prop.name}_Is_Empty()`);
    lines.push('    {');
    lines.push(`        // Arrange`);
    lines.push(`        var model = new ${model.name}`);
    lines.push('        {');
    lines.push(`            ${prop.name} = ${getEmptyValue(prop.type.name)},`);
    lines.push('        };');
    lines.push('');
    lines.push('        // Act');
    lines.push(`        var result = _validator.TestValidate(model);`);
    lines.push('');
    lines.push('        // Assert');
    lines.push(`        result.ShouldHaveValidationErrorFor(x => x.${prop.name});`);
    lines.push('    }');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get a default test value for a C# type
 */
function getDefaultTestValue(typeName: string): string {
  switch (typeName.toLowerCase()) {
    case 'string': return '"test-value"';
    case 'int': return '42';
    case 'long': return '42L';
    case 'double': return '3.14';
    case 'float': return '3.14f';
    case 'decimal': return '9.99m';
    case 'bool': return 'true';
    case 'guid': return 'Guid.NewGuid()';
    case 'datetimeoffset': return 'DateTimeOffset.UtcNow';
    case 'datetime': return 'DateTime.UtcNow';
    case 'dateonly': return 'DateOnly.FromDateTime(DateTime.UtcNow)';
    case 'timeonly': return 'TimeOnly.FromDateTime(DateTime.UtcNow)';
    case 'uri': return 'new Uri("https://example.com")';
    case 'byte[]': return 'new byte[] { 1, 2, 3 }';
    default:
      if (typeName.startsWith('List<')) return `new ${typeName}()`;
      return `default(${typeName})!`;
  }
}

/**
 * Get an empty/default value for validation tests
 */
function getEmptyValue(typeName: string): string {
  switch (typeName.toLowerCase()) {
    case 'string': return '""';
    case 'int': return '0';
    case 'long': return '0L';
    case 'double': return '0.0';
    case 'float': return '0.0f';
    case 'decimal': return '0m';
    case 'bool': return 'false';
    case 'guid': return 'Guid.Empty';
    case 'datetimeoffset': return 'default';
    case 'datetime': return 'default';
    default: return 'default!';
  }
}

/**
 * Get an assertion for a type
 */
function getAssertionForType(typeName: string, propName: string): string {
  switch (typeName.toLowerCase()) {
    case 'string': return `Assert.False(string.IsNullOrEmpty(entity.${propName}));`;
    case 'guid': return `Assert.NotEqual(Guid.Empty, entity.${propName});`;
    case 'int':
    case 'long':
    case 'double':
    case 'float':
    case 'decimal':
      return `Assert.NotEqual(default, entity.${propName});`;
    default:
      return `Assert.NotNull(entity.${propName});`;
  }
}
