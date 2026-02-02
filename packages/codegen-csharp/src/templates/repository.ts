// ============================================================================
// C# Repository Templates
// ============================================================================

import type { CSharpClassInfo, CSharpGeneratorOptions } from '../types';
import { generateUsings, generateXmlDoc } from './model';

/**
 * Generate repository interface
 */
export function generateRepositoryInterface(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const interfaceName = `I${model.name}Repository`;
  const parts: string[] = [];

  // Usings
  const usings = [model.namespace];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Repositories;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Repository interface for ${model.name} data access`));
  }

  // Interface declaration
  parts.push(`public interface ${interfaceName}`);
  parts.push('{');

  const ct = options.asyncMethods ? ', CancellationToken cancellationToken = default' : '';
  const taskPrefix = options.asyncMethods ? 'Task<' : '';
  const taskSuffix = options.asyncMethods ? '>' : '';

  // Methods
  const methods = [
    { sig: `${taskPrefix}IEnumerable<${model.name}>${taskSuffix} GetAllAsync(${ct.slice(2)})`, doc: 'Get all entities' },
    { sig: `${taskPrefix}${model.name}?${taskSuffix} GetByIdAsync(Guid id${ct})`, doc: 'Get entity by ID' },
    { sig: `${taskPrefix}IEnumerable<${model.name}>${taskSuffix} FindAsync(Func<${model.name}, bool> predicate${ct})`, doc: 'Find entities by predicate' },
    { sig: `${taskPrefix}${model.name}${taskSuffix} CreateAsync(${model.name} entity${ct})`, doc: 'Create new entity' },
    { sig: `${taskPrefix}${model.name}${taskSuffix} UpdateAsync(${model.name} entity${ct})`, doc: 'Update existing entity' },
    { sig: `${taskPrefix}bool${taskSuffix} DeleteAsync(Guid id${ct})`, doc: 'Delete entity by ID' },
    { sig: `${taskPrefix}bool${taskSuffix} ExistsAsync(Guid id${ct})`, doc: 'Check if entity exists' },
    { sig: `${taskPrefix}int${taskSuffix} CountAsync(${ct.slice(2)})`, doc: 'Count all entities' },
  ];

  for (const method of methods) {
    if (options.generateXmlDocs) {
      parts.push(generateXmlDoc(method.doc, '    '));
    }
    parts.push(`    ${method.sig};\n`);
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate Entity Framework repository implementation
 */
export function generateEFRepository(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const repoName = `${model.name}Repository`;
  const interfaceName = `I${model.name}Repository`;
  const dbContextName = `${options.namespace.split('.').pop()}DbContext`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.EntityFrameworkCore',
    model.namespace,
    `${model.namespace}.Data`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Repositories;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Entity Framework repository implementation for ${model.name}`));
  }

  // Class declaration
  parts.push(`public class ${repoName} : ${interfaceName}`);
  parts.push('{');

  // Fields
  parts.push(`    private readonly ${dbContextName} _context;`);
  parts.push(`    private readonly DbSet<${model.name}> _dbSet;\n`);

  // Constructor
  parts.push(`    public ${repoName}(${dbContextName} context)`);
  parts.push('    {');
  parts.push('        _context = context;');
  parts.push(`        _dbSet = context.Set<${model.name}>();`);
  parts.push('    }\n');

  // Methods
  parts.push(generateEFGetAll(model.name, options));
  parts.push('');
  parts.push(generateEFGetById(model.name, options));
  parts.push('');
  parts.push(generateEFFind(model.name, options));
  parts.push('');
  parts.push(generateEFCreate(model.name, options));
  parts.push('');
  parts.push(generateEFUpdate(model.name, options));
  parts.push('');
  parts.push(generateEFDelete(model.name, options));
  parts.push('');
  parts.push(generateEFExists(model.name, options));
  parts.push('');
  parts.push(generateEFCount(model.name, options));

  parts.push('}');

  return parts.join('\n');
}

function generateEFGetAll(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? 'CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<IEnumerable<' + modelName + '>>' : 'IEnumerable<' + modelName + '>'} GetAllAsync(${ct})
    {
        return ${async_ ? 'await _dbSet.ToListAsync(' + ctArg + ')' : '_dbSet.ToList()'};
    }`;
}

function generateEFGetById(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? ', cancellationToken' : '';

  return `    public ${async_ ? 'async Task<' + modelName + '?>' : modelName + '?'} GetByIdAsync(Guid id${ct})
    {
        return ${async_ ? 'await _dbSet.FindAsync(new object[] { id }' + ctArg + ')' : '_dbSet.Find(id)'};
    }`;
}

function generateEFFind(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';

  return `    public ${async_ ? 'async Task<IEnumerable<' + modelName + '>>' : 'IEnumerable<' + modelName + '>'} FindAsync(Func<${modelName}, bool> predicate${ct})
    {
        return ${async_ ? 'await Task.FromResult(_dbSet.Where(predicate).ToList())' : '_dbSet.Where(predicate).ToList()'};
    }`;
}

function generateEFCreate(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<' + modelName + '>' : modelName} CreateAsync(${modelName} entity${ct})
    {
        _dbSet.Add(entity);
        ${async_ ? 'await _context.SaveChangesAsync(' + ctArg + ')' : '_context.SaveChanges()'};
        return entity;
    }`;
}

function generateEFUpdate(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<' + modelName + '>' : modelName} UpdateAsync(${modelName} entity${ct})
    {
        _context.Entry(entity).State = EntityState.Modified;
        ${async_ ? 'await _context.SaveChangesAsync(' + ctArg + ')' : '_context.SaveChanges()'};
        return entity;
    }`;
}

function generateEFDelete(_modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<bool>' : 'bool'} DeleteAsync(Guid id${ct})
    {
        var entity = ${async_ ? 'await _dbSet.FindAsync(new object[] { id }' + (async_ ? ', ' + ctArg : '') + ')' : '_dbSet.Find(id)'};
        if (entity == null) return false;
        
        _dbSet.Remove(entity);
        ${async_ ? 'await _context.SaveChangesAsync(' + ctArg + ')' : '_context.SaveChanges()'};
        return true;
    }`;
}

function generateEFExists(_modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<bool>' : 'bool'} ExistsAsync(Guid id${ct})
    {
        return ${async_ ? 'await _dbSet.AnyAsync(e => EF.Property<Guid>(e, "Id") == id, ' + ctArg + ')' : '_dbSet.Any(e => EF.Property<Guid>(e, "Id") == id)'};
    }`;
}

function generateEFCount(_modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const ct = async_ ? 'CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? 'cancellationToken' : '';

  return `    public ${async_ ? 'async Task<int>' : 'int'} CountAsync(${ct})
    {
        return ${async_ ? 'await _dbSet.CountAsync(' + ctArg + ')' : '_dbSet.Count()'};
    }`;
}

/**
 * Generate DbContext
 */
export function generateDbContext(
  models: CSharpClassInfo[],
  options: CSharpGeneratorOptions
): string {
  const dbContextName = `${options.namespace.split('.').pop()}DbContext`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.EntityFrameworkCore',
    options.namespace,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${options.namespace}.Data;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc('Entity Framework database context'));
  }

  // Class declaration
  parts.push(`public class ${dbContextName} : DbContext`);
  parts.push('{');

  // Constructor
  parts.push(`    public ${dbContextName}(DbContextOptions<${dbContextName}> options) : base(options) { }\n`);

  // DbSets
  for (const model of models) {
    if (options.generateXmlDocs) {
      parts.push(generateXmlDoc(`${model.name} entities`, '    '));
    }
    parts.push(`    public DbSet<${model.name}> ${model.name}s { get; set; } = null!;\n`);
  }

  // OnModelCreating
  parts.push('    protected override void OnModelCreating(ModelBuilder modelBuilder)');
  parts.push('    {');
  parts.push('        base.OnModelCreating(modelBuilder);');
  parts.push('');
  
  for (const model of models) {
    parts.push(`        modelBuilder.Entity<${model.name}>(entity =>`);
    parts.push('        {');
    parts.push(`            entity.HasKey(e => e.Id);`);
    parts.push(`            entity.ToTable("${model.name}s");`);
    parts.push('        });');
    parts.push('');
  }
  
  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate repository DI extension
 */
export function generateRepositoryDIExtension(
  models: CSharpClassInfo[],
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.Extensions.DependencyInjection',
    `${options.namespace}.Repositories`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${options.namespace}.Extensions;\n`);

  // Class
  parts.push('public static class RepositoryExtensions');
  parts.push('{');
  parts.push('    public static IServiceCollection AddRepositories(this IServiceCollection services)');
  parts.push('    {');

  for (const model of models) {
    parts.push(`        services.AddScoped<I${model.name}Repository, ${model.name}Repository>();`);
  }

  parts.push('        return services;');
  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}
