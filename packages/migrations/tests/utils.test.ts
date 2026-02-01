/**
 * Tests for Migration Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  applyNamingConvention,
  serializeType,
  islTypeToSql,
  isTypeSafeChange,
  serializeDefault,
  escapeString,
  quoteIdentifier,
  qualifiedTableName,
  generateIndexName,
  generateForeignKeyName,
  generateConstraintName,
  generateMigrationName,
  arraysEqual,
  getAdded,
  getRemoved,
} from '../src/utils.js';

describe('Naming Conventions', () => {
  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('userName')).toBe('user_name');
      expect(toSnakeCase('createdAt')).toBe('created_at');
    });
    
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('UserName')).toBe('user_name');
      expect(toSnakeCase('CreatedAt')).toBe('created_at');
    });
    
    it('should handle already snake_case', () => {
      expect(toSnakeCase('user_name')).toBe('user_name');
    });
    
    it('should handle single words', () => {
      expect(toSnakeCase('user')).toBe('user');
      expect(toSnakeCase('User')).toBe('user');
    });
  });
  
  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('user_name')).toBe('userName');
      expect(toCamelCase('created_at')).toBe('createdAt');
    });
    
    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('UserName')).toBe('userName');
    });
  });
  
  describe('toPascalCase', () => {
    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('user_name')).toBe('UserName');
    });
    
    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('userName')).toBe('UserName');
    });
  });
  
  describe('applyNamingConvention', () => {
    it('should apply snake_case convention', () => {
      expect(applyNamingConvention('UserName', 'snake_case')).toBe('user_name');
    });
    
    it('should apply camelCase convention', () => {
      expect(applyNamingConvention('user_name', 'camelCase')).toBe('userName');
    });
    
    it('should apply PascalCase convention', () => {
      expect(applyNamingConvention('user_name', 'PascalCase')).toBe('UserName');
    });
  });
});

describe('Type Serialization', () => {
  describe('serializeType', () => {
    it('should serialize simple type', () => {
      const type = { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'String', span: {} as never }, span: {} as never };
      expect(serializeType(type)).toBe('String');
    });
    
    it('should serialize generic type', () => {
      const type = {
        kind: 'GenericType' as const,
        name: { kind: 'Identifier' as const, name: 'List', span: {} as never },
        typeArguments: [{ kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'String', span: {} as never }, span: {} as never }],
        span: {} as never,
      };
      expect(serializeType(type)).toBe('List<String>');
    });
    
    it('should serialize array type', () => {
      const type = {
        kind: 'ArrayType' as const,
        elementType: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'Int', span: {} as never }, span: {} as never },
        span: {} as never,
      };
      expect(serializeType(type)).toBe('Int[]');
    });
  });
});

describe('SQL Type Mapping', () => {
  describe('islTypeToSql', () => {
    it('should map ISL types to PostgreSQL', () => {
      expect(islTypeToSql('String', 'postgresql')).toBe('TEXT');
      expect(islTypeToSql('Int', 'postgresql')).toBe('INTEGER');
      expect(islTypeToSql('Boolean', 'postgresql')).toBe('BOOLEAN');
      expect(islTypeToSql('DateTime', 'postgresql')).toBe('TIMESTAMP WITH TIME ZONE');
      expect(islTypeToSql('UUID', 'postgresql')).toBe('UUID');
      expect(islTypeToSql('JSON', 'postgresql')).toBe('JSONB');
    });
    
    it('should map ISL types to MySQL', () => {
      expect(islTypeToSql('String', 'mysql')).toBe('VARCHAR(255)');
      expect(islTypeToSql('Int', 'mysql')).toBe('INT');
      expect(islTypeToSql('Boolean', 'mysql')).toBe('TINYINT(1)');
      expect(islTypeToSql('UUID', 'mysql')).toBe('CHAR(36)');
    });
    
    it('should map ISL types to SQLite', () => {
      expect(islTypeToSql('String', 'sqlite')).toBe('TEXT');
      expect(islTypeToSql('Int', 'sqlite')).toBe('INTEGER');
      expect(islTypeToSql('Boolean', 'sqlite')).toBe('INTEGER');
    });
    
    it('should handle array types in PostgreSQL', () => {
      expect(islTypeToSql('String[]', 'postgresql')).toBe('TEXT[]');
    });
    
    it('should use custom mapping when provided', () => {
      const customMapping = { CustomType: 'CUSTOM_SQL_TYPE' };
      expect(islTypeToSql('CustomType', 'postgresql', customMapping)).toBe('CUSTOM_SQL_TYPE');
    });
    
    it('should fall back to TEXT for unknown types', () => {
      expect(islTypeToSql('UnknownType', 'postgresql')).toBe('TEXT');
    });
  });
  
  describe('isTypeSafeChange', () => {
    it('should identify safe integer upgrades', () => {
      expect(isTypeSafeChange('INT', 'BIGINT')).toBe(true);
      expect(isTypeSafeChange('INTEGER', 'BIGINT')).toBe(true);
      expect(isTypeSafeChange('SMALLINT', 'INT')).toBe(true);
    });
    
    it('should identify safe string upgrades', () => {
      expect(isTypeSafeChange('VARCHAR', 'TEXT')).toBe(true);
      expect(isTypeSafeChange('CHAR', 'VARCHAR')).toBe(true);
    });
    
    it('should identify same type as safe', () => {
      expect(isTypeSafeChange('TEXT', 'TEXT')).toBe(true);
      expect(isTypeSafeChange('INT', 'INT')).toBe(true);
    });
    
    it('should identify unsafe changes', () => {
      expect(isTypeSafeChange('BIGINT', 'INT')).toBe(false);
      expect(isTypeSafeChange('TEXT', 'VARCHAR')).toBe(false);
    });
  });
});

describe('SQL Generation Helpers', () => {
  describe('serializeDefault', () => {
    it('should serialize string default', () => {
      expect(serializeDefault({ kind: 'string', value: 'hello' })).toBe("'hello'");
    });
    
    it('should serialize number default', () => {
      expect(serializeDefault({ kind: 'number', value: 42 })).toBe('42');
    });
    
    it('should serialize boolean default for PostgreSQL', () => {
      expect(serializeDefault({ kind: 'boolean', value: true }, 'postgresql')).toBe('TRUE');
      expect(serializeDefault({ kind: 'boolean', value: false }, 'postgresql')).toBe('FALSE');
    });
    
    it('should serialize boolean default for MySQL', () => {
      expect(serializeDefault({ kind: 'boolean', value: true }, 'mysql')).toBe('1');
      expect(serializeDefault({ kind: 'boolean', value: false }, 'mysql')).toBe('0');
    });
    
    it('should serialize null default', () => {
      expect(serializeDefault({ kind: 'null' })).toBe('NULL');
    });
  });
  
  describe('escapeString', () => {
    it('should escape single quotes', () => {
      expect(escapeString("it's")).toBe("it''s");
      expect(escapeString("don't")).toBe("don''t");
    });
    
    it('should handle strings without quotes', () => {
      expect(escapeString('hello')).toBe('hello');
    });
  });
  
  describe('quoteIdentifier', () => {
    it('should quote for PostgreSQL', () => {
      expect(quoteIdentifier('user', 'postgresql')).toBe('"user"');
    });
    
    it('should quote for MySQL', () => {
      expect(quoteIdentifier('user', 'mysql')).toBe('`user`');
    });
    
    it('should quote for MSSQL', () => {
      expect(quoteIdentifier('user', 'mssql')).toBe('[user]');
    });
  });
  
  describe('qualifiedTableName', () => {
    it('should generate table name without schema', () => {
      expect(qualifiedTableName('users')).toBe('"users"');
    });
    
    it('should generate table name with schema', () => {
      expect(qualifiedTableName('users', 'public')).toBe('"public"."users"');
    });
  });
  
  describe('generateIndexName', () => {
    it('should generate index name', () => {
      expect(generateIndexName('users', ['email'])).toBe('idx_users_email');
    });
    
    it('should generate unique index name', () => {
      expect(generateIndexName('users', ['email'], true)).toBe('uix_users_email');
    });
    
    it('should handle multiple columns', () => {
      expect(generateIndexName('users', ['firstName', 'lastName'])).toBe('idx_users_first_name_last_name');
    });
  });
  
  describe('generateForeignKeyName', () => {
    it('should generate foreign key name', () => {
      expect(generateForeignKeyName('posts', 'userId', 'users')).toBe('fk_posts_user_id_users');
    });
  });
  
  describe('generateConstraintName', () => {
    it('should generate primary key name', () => {
      expect(generateConstraintName('users', 'pk', ['id'])).toBe('pk_users_id');
    });
    
    it('should generate unique key name', () => {
      expect(generateConstraintName('users', 'uk', ['email'])).toBe('uk_users_email');
    });
  });
});

describe('Migration Name Generation', () => {
  describe('generateMigrationName', () => {
    it('should generate timestamped migration name', () => {
      const name = generateMigrationName('create_users');
      expect(name).toMatch(/^\d{14}_create_users$/);
    });
    
    it('should slugify description', () => {
      const name = generateMigrationName('Create Users Table');
      expect(name).toMatch(/^\d{14}_create_users_table$/);
    });
  });
});

describe('Array Utilities', () => {
  describe('arraysEqual', () => {
    it('should return true for equal arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });
    
    it('should return true for equal arrays in different order', () => {
      expect(arraysEqual([1, 2, 3], [3, 1, 2])).toBe(true);
    });
    
    it('should return false for different arrays', () => {
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });
    
    it('should handle empty arrays', () => {
      expect(arraysEqual([], [])).toBe(true);
    });
  });
  
  describe('getAdded', () => {
    it('should return added elements', () => {
      expect(getAdded([1, 2], [1, 2, 3, 4])).toEqual([3, 4]);
    });
    
    it('should return empty array when nothing added', () => {
      expect(getAdded([1, 2, 3], [1, 2])).toEqual([]);
    });
  });
  
  describe('getRemoved', () => {
    it('should return removed elements', () => {
      expect(getRemoved([1, 2, 3, 4], [1, 2])).toEqual([3, 4]);
    });
    
    it('should return empty array when nothing removed', () => {
      expect(getRemoved([1, 2], [1, 2, 3])).toEqual([]);
    });
  });
});
