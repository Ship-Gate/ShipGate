/**
 * ISL Studio - Rules CLI Commands
 * 
 * Commands:
 *   islstudio rules list
 *   islstudio rules explain <rule-id>
 *   islstudio rules pack list
 *   islstudio rules pack enable <pack>
 */

import { 
  createRegistry, 
  loadBuiltinPacks,
  explainRule,
  formatExplanationTerminal,
} from '@isl-lang/policy-packs';

export async function runRulesCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === 'list') {
    await listRules();
  } else if (subcommand === 'explain') {
    const ruleId = args[1];
    if (!ruleId) {
      console.error('Usage: islstudio rules explain <rule-id>');
      process.exit(1);
    }
    explainRuleCmd(ruleId);
  } else if (subcommand === 'pack') {
    const packCmd = args[1];
    if (packCmd === 'list') {
      await listPacks();
    } else if (packCmd === 'enable' || packCmd === 'disable') {
      const packId = args[2];
      if (!packId) {
        console.error(`Usage: islstudio rules pack ${packCmd} <pack-id>`);
        process.exit(1);
      }
      console.log(`\nTo ${packCmd} the "${packId}" pack, update your .islstudio/config.json:\n`);
      console.log(`{
  "packs": {
    "${packId}": { "enabled": ${packCmd === 'enable'} }
  }
}`);
    } else {
      printRulesHelp();
    }
  } else {
    printRulesHelp();
  }
}

async function listRules(): Promise<void> {
  const registry = createRegistry();
  await loadBuiltinPacks(registry);
  const rules = registry.getEnabledRules();

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    ISL Studio Rules                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const byPack = new Map<string, typeof rules>();
  for (const rule of rules) {
    const pack = rule.id.split('/')[0];
    if (!byPack.has(pack)) {
      byPack.set(pack, []);
    }
    byPack.get(pack)!.push(rule);
  }

  for (const [pack, packRules] of byPack) {
    console.log(`\n${pack.toUpperCase()} (${packRules.length} rules)`);
    console.log('─'.repeat(50));
    for (const rule of packRules) {
      const severity = rule.severity === 'error' ? '🛑' : rule.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${severity} ${rule.id}`);
      console.log(`     ${rule.description}`);
    }
  }

  console.log(`\n\nTotal: ${rules.length} rules\n`);
  console.log('Run "islstudio rules explain <rule-id>" for details.\n');
}

function explainRuleCmd(ruleId: string): void {
  const explanation = explainRule(ruleId);
  
  if (!explanation) {
    console.error(`\nRule "${ruleId}" not found.\n`);
    console.log('Run "islstudio rules list" to see all available rules.\n');
    process.exit(1);
  }

  console.log(formatExplanationTerminal(explanation));
}

async function listPacks(): Promise<void> {
  const registry = createRegistry();
  await loadBuiltinPacks(registry);
  const packs = registry.getAllPacks();

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                   ISL Studio Packs                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  for (const pack of packs) {
    console.log(`📦 ${pack.id}`);
    console.log(`   ${pack.description}`);
    console.log(`   Rules: ${pack.rules.length}`);
    console.log('');
  }

  console.log('Configure packs in .islstudio/config.json:\n');
  console.log(`{
  "packs": {
    "auth": { "enabled": true },
    "pii": { "enabled": true },
    "payments": { "enabled": false }
  }
}\n`);
}

function printRulesHelp(): void {
  console.log(`
ISL Studio - Rules Management

COMMANDS
  islstudio rules list              List all rules
  islstudio rules explain <id>      Show detailed explanation for a rule
  islstudio rules pack list         List all policy packs
  islstudio rules pack enable <id>  Show how to enable a pack
  islstudio rules pack disable <id> Show how to disable a pack

EXAMPLES
  islstudio rules list
  islstudio rules explain auth/bypass-detected
  islstudio rules pack list
  islstudio rules pack enable payments
`);
}
