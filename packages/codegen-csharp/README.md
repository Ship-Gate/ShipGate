# @isl-lang/codegen-csharp

C#/.NET code generator for ISL — generates compilable ASP.NET Core models, DTOs, controllers, services, repositories, and xUnit tests from ISL domain specifications.

## Installation

```bash
pnpm add @isl-lang/codegen-csharp
```

## Quick Start

```typescript
import { generate } from '@isl-lang/codegen-csharp';

const domain = {
  name: 'Shop',
  entities: [
    {
      name: 'Product',
      description: 'A product in the catalog',
      properties: [
        { name: 'name', type: 'String', required: true },
        { name: 'price', type: 'Decimal', required: true },
        { name: 'sku', type: 'String', required: true },
      ],
    },
  ],
};

const result = generate(domain, {
  namespace: 'Shop.Api',
  framework: 'net8.0',
  webFramework: 'aspnet-core',
  validation: 'data-annotations',
  orm: 'entity-framework',
  generateTests: true,
});

// result.files       → generated .cs files
// result.projectFile → .csproj content
// result.solutionFile → .sln content
// result.statistics  → { models, services, controllers, validators, tests, totalLines }
```

## Generated Output

For each ISL entity the generator produces:

| File | Description |
|---|---|
| `Models/{Entity}.cs` | Model class/record with data annotations |
| `Dtos/Create{Entity}Dto.cs` | DTO for creation (excludes Id, timestamps) |
| `Dtos/Update{Entity}Dto.cs` | DTO for partial updates (all fields nullable) |
| `Dtos/{Entity}ResponseDto.cs` | Response DTO with all fields |
| `Controllers/{Entity}Controller.cs` | ASP.NET Core controller with CRUD endpoints |
| `Services/I{Entity}Service.cs` | Service interface |
| `Services/{Entity}Service.cs` | Service implementation |
| `Repositories/I{Entity}Repository.cs` | Repository interface |
| `Repositories/{Entity}Repository.cs` | EF Core repository implementation |
| `Validators/{Entity}Validator.cs` | FluentValidation validator (if enabled) |
| `Data/DbContext.cs` | EF Core DbContext |
| `Tests/{Entity}Tests.cs` | xUnit model tests |
| `Tests/{Entity}ControllerTests.cs` | xUnit controller tests (with Moq) |

Plus DI extension methods, project files, and solution file.

## Wiring into an ASP.NET Project

### 1. Generate the code

```typescript
import { generate } from '@isl-lang/codegen-csharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const result = generate(domain, { namespace: 'MyApp.Api', /* ... */ });

// Write all generated files
const outDir = './generated';
for (const file of result.files) {
  const fullPath = join(outDir, 'src', file.path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, file.content);
}

// Write project files
writeFileSync(join(outDir, 'src', 'MyApp.Api.csproj'), result.projectFile);
writeFileSync(join(outDir, 'tests', 'MyApp.Api.Tests.csproj'),
  result.files.find(f => f.path === 'Tests/Tests.csproj')!.content);
writeFileSync(join(outDir, 'MyApp.Api.sln'), result.solutionFile!);
```

### 2. Build & test

```bash
cd generated
dotnet build
dotnet test
```

### 3. Register services in `Program.cs`

```csharp
using MyApp.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add generated services
builder.Services.AddServices();
builder.Services.AddRepositories();
builder.Services.AddValidators(); // if FluentValidation enabled

// Add EF Core
builder.Services.AddDbContext<GeneratedDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.Run();
```

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `framework` | `DotNetFramework` | `net8.0` | Target .NET framework |
| `webFramework` | `WebFramework` | `aspnet-minimal` | `aspnet-core`, `aspnet-minimal`, `none` |
| `orm` | `ORMFramework` | `entity-framework` | `entity-framework`, `dapper`, `none` |
| `validation` | `ValidationLibrary` | `fluent-validation` | `fluent-validation`, `data-annotations`, `both`, `none` |
| `namespace` | `string` | `Generated` | Root namespace |
| `useRecords` | `boolean` | `true` | Use C# records instead of classes |
| `generateTests` | `boolean` | `true` | Generate xUnit tests |
| `nullableReferenceTypes` | `boolean` | `true` | Enable nullable reference types |
| `asyncMethods` | `boolean` | `true` | Generate async methods |
| `generateXmlDocs` | `boolean` | `true` | Generate XML documentation |

## ISL → C# Type Mapping

| ISL Type | C# Type |
|---|---|
| `String` | `string` |
| `Int` | `int` |
| `Float` | `double` |
| `Boolean` | `bool` |
| `UUID` / `ID` | `Guid` |
| `DateTime` | `DateTimeOffset` |
| `Date` | `DateOnly` |
| `Time` | `TimeOnly` |
| `Decimal` / `Money` | `decimal` |
| `Email` / `Phone` | `string` |
| `URL` | `Uri` |
| `JSON` | `JsonElement` |
| `Binary` | `byte[]` |
| `T[]` | `List<T>` |
| `T?` | `T?` (nullable) |

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests (48 tests + 14 snapshots)
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
