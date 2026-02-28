# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SchemaVersion, ISLSchema, DomainSchema, EntitySchema, FieldSchema, ConstraintSchema, BehaviorSchema, ErrorSchema, EnumSchema, TypeSchema, SchemaChange, ChangeType, MigrationStep, MigrationStepType, MigrationPlan, MigrationWarning, CompatibilityReport, EvolutionPolicy, VersionHistory, DataMigrator
# dependencies: 

domain Types {
  version: "1.0.0"

  type SchemaVersion = String
  type ISLSchema = String
  type DomainSchema = String
  type EntitySchema = String
  type FieldSchema = String
  type ConstraintSchema = String
  type BehaviorSchema = String
  type ErrorSchema = String
  type EnumSchema = String
  type TypeSchema = String
  type SchemaChange = String
  type ChangeType = String
  type MigrationStep = String
  type MigrationStepType = String
  type MigrationPlan = String
  type MigrationWarning = String
  type CompatibilityReport = String
  type EvolutionPolicy = String
  type VersionHistory = String
  type DataMigrator = String

  invariants exports_present {
    - true
  }
}
