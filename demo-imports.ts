#!/usr/bin/env npx tsx
/**
 * Demo: Import Resolution
 * 
 * Shows how `use stdlib-*` works to include pre-built, verified components.
 */

import { preprocessSource, getAvailableLibraries, getLibraryInfo } from './packages/isl-compiler/dist/index.js';
import { parse } from './packages/parser/dist/index.js';

function printHeader(text: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${text}`);
  console.log('═'.repeat(70));
}

function printSection(text: string) {
  console.log('\n' + '─'.repeat(50));
  console.log(`  ${text}`);
  console.log('─'.repeat(50));
}

async function runDemo() {
  printHeader('📦 IMPORT RESOLUTION DEMO');
  
  // Show available libraries
  printSection('Available Standard Libraries');
  
  const libraries = getAvailableLibraries();
  console.log('\nYou can use any of these with `use <library-name>`:\n');
  
  for (const lib of libraries) {
    const info = getLibraryInfo(lib);
    if (info) {
      console.log(`  ${lib}`);
      console.log(`    Entities:  ${info.entities.join(', ')}`);
      console.log(`    Behaviors: ${info.behaviors.join(', ')}`);
      console.log(`    Enums:     ${info.enums.join(', ')}`);
      console.log('');
    }
  }
  
  // Demo: Using imports
  printSection('Example: Building a SaaS App');
  
  const sourceWithImports = `
domain MySaaSApp {
  version: "1.0.0"
  
  use stdlib-auth
  use stdlib-payments
  use stdlib-saas
  
  entity Document {
    id: UUID [immutable, unique]
    organization_id: UUID [indexed]
    title: String
    content: String
    created_by: UUID
    created_at: Timestamp [immutable]
  }
  
  behavior CreateDocument {
    description: "Create a new document in an organization"
    
    input {
      organization_id: UUID
      title: String
      content: String
    }
    
    output {
      success: Document
      errors {
        ORG_NOT_FOUND {
          when: "Organization does not exist"
        }
        NOT_AUTHORIZED {
          when: "User not a member of organization"
        }
      }
    }
  }
}`;

  console.log('\nYour ISL spec (with imports):\n');
  console.log('```isl');
  console.log(sourceWithImports.trim());
  console.log('```\n');
  
  // Resolve imports
  printSection('After Import Resolution');
  
  const { source: resolvedSource, imports, errors } = preprocessSource(sourceWithImports);
  
  if (errors.length > 0) {
    console.log('\n❌ Import errors:');
    errors.forEach(e => console.log(`  • ${e}`));
    return;
  }
  
  console.log('\n✅ Imports resolved successfully!\n');
  console.log('Libraries loaded:');
  imports.forEach(lib => {
    const info = getLibraryInfo(lib);
    if (info) {
      console.log(`  • ${lib}: +${info.entities.length} entities, +${info.behaviors.length} behaviors`);
    }
  });
  
  // Count what we have now
  printSection('What You Get');
  
  // Parse to count entities and behaviors
  const parseResult = parse(resolvedSource);
  
  if (parseResult.success && parseResult.domain) {
    const domain = parseResult.domain;
    
    // Count items
    const totalEntities = domain.entities?.length || 0;
    const totalBehaviors = domain.behaviors?.length || 0;
    const totalEnums = domain.enums?.length || 0;
    
    console.log(`
  Your spec defined:    1 entity, 1 behavior
  
  After imports:
    Total Entities:     ${totalEntities} (User, Session, Payment, Subscription, Organization, TeamMember, Project, Document)
    Total Behaviors:    ${totalBehaviors} (Login, Logout, Register, Charge, Refund, CreateOrganization, InviteTeamMember, CreateDocument)
    Total Enums:        ${totalEnums} (UserStatus, PaymentStatus, SubscriptionStatus, OrganizationStatus, TeamRole)
  
  You wrote:            ~40 lines
  You get:              Complete SaaS foundation with auth, payments, teams
`);
  } else {
    console.log('\n⚠️  Could not parse resolved source');
    console.log('Errors:', parseResult.errors.map(e => e.message).slice(0, 5));
  }
  
  // Show the value
  printSection('💡 The Power of Imports');
  
  console.log(`
  WITHOUT imports:
    • Write 500+ lines of ISL for auth, payments, teams
    • Define all entities, behaviors, error cases
    • Risk missing security constraints
    • Repeat work every project
  
  WITH imports:
    • Write 3 lines: use stdlib-auth, stdlib-payments, stdlib-saas
    • Get pre-verified, production-ready definitions
    • Security constraints included
    • Focus only on YOUR unique features
  
  This is like npm for software specifications!
`);
  
  printHeader('Demo Complete');
}

runDemo().catch(console.error);
