/**
 * ISL Contract Syntax
 * 
 * Parse and generate ISL smart contract specifications
 */

import type { Contract, ContractFunction, StateVariable, ContractEvent, ContractInvariant } from './types';

/**
 * Parse ISL contract specification
 */
export function parseContractISL(isl: string): Contract {
  const lines = isl.split('\n').map(l => l.trim());
  const contract: Contract = {
    name: '',
    version: '1.0.0',
    state: [],
    functions: [],
    events: [],
    modifiers: [],
    invariants: [],
  };

  let currentSection: 'state' | 'functions' | 'events' | 'invariants' | null = null;
  let currentFunction: Partial<ContractFunction> | null = null;

  for (const line of lines) {
    if (!line || line.startsWith('//')) continue;

    // Contract declaration
    if (line.startsWith('contract ')) {
      contract.name = line.replace('contract ', '').replace(' {', '').trim();
      continue;
    }

    // Version
    if (line.startsWith('version ')) {
      contract.version = line.replace('version ', '').replace(/[";]/g, '').trim();
      continue;
    }

    // License
    if (line.startsWith('license ')) {
      contract.license = line.replace('license ', '').replace(/[";]/g, '').trim();
      continue;
    }

    // Section headers
    if (line === 'state {') {
      currentSection = 'state';
      continue;
    }
    if (line === 'functions {' || line === 'behaviors {') {
      currentSection = 'functions';
      continue;
    }
    if (line === 'events {') {
      currentSection = 'events';
      continue;
    }
    if (line === 'invariants {') {
      currentSection = 'invariants';
      continue;
    }
    if (line === '}') {
      if (currentFunction) {
        contract.functions.push(currentFunction as ContractFunction);
        currentFunction = null;
      }
      currentSection = null;
      continue;
    }

    // Parse section content
    switch (currentSection) {
      case 'state':
        parseStateVariable(line, contract.state);
        break;
      case 'functions':
        parseFunctionLine(line, contract.functions, currentFunction);
        break;
      case 'events':
        parseEventDeclaration(line, contract.events);
        break;
      case 'invariants':
        parseInvariant(line, contract.invariants);
        break;
    }
  }

  return contract;
}

/**
 * Parse state variable declaration
 */
function parseStateVariable(line: string, state: StateVariable[]): void {
  // Format: visibility type name [= value];
  const match = line.match(/^(public|private|internal)?\s*(\w+)\s+(\w+)(?:\s*=\s*(.+))?;$/);
  if (match) {
    state.push({
      name: match[3],
      type: match[2] as StateVariable['type'],
      visibility: (match[1] as StateVariable['visibility']) ?? 'private',
      initialValue: match[4],
    });
  }
}

/**
 * Parse function line
 */
function parseFunctionLine(
  line: string,
  functions: ContractFunction[],
  _current: Partial<ContractFunction> | null
): void {
  // Simple function declaration: function name(params) visibility mutability;
  const match = line.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*(public|external|internal|private)?\s*(pure|view|payable)?;$/);
  if (match) {
    const params = match[2] ? match[2].split(',').map(p => {
      const [type, name] = p.trim().split(/\s+/);
      return { name: name || 'param', type: type as StateVariable['type'] };
    }) : [];

    functions.push({
      name: match[1],
      visibility: (match[3] as ContractFunction['visibility']) ?? 'public',
      mutability: (match[4] as ContractFunction['mutability']) ?? 'nonpayable',
      params,
      returns: [],
    });
  }
}

/**
 * Parse event declaration
 */
function parseEventDeclaration(line: string, events: ContractEvent[]): void {
  // Format: event Name(type1 name1, type2 indexed name2);
  const match = line.match(/^event\s+(\w+)\s*\(([^)]*)\);$/);
  if (match) {
    const params = match[2] ? match[2].split(',').map(p => {
      const parts = p.trim().split(/\s+/);
      const indexed = parts.includes('indexed');
      const type = parts[0];
      const name = parts[parts.length - 1];
      return { name, type: type as StateVariable['type'], indexed };
    }) : [];

    events.push({ name: match[1], params });
  }
}

/**
 * Parse invariant
 */
function parseInvariant(line: string, invariants: ContractInvariant[]): void {
  // Format: invariantName: expression;
  const match = line.match(/^(\w+):\s*(.+);$/);
  if (match) {
    invariants.push({
      name: match[1],
      expression: match[2],
    });
  }
}

/**
 * Generate ISL from contract
 */
export function generateContractISL(contract: Contract): string {
  const lines: string[] = [];

  lines.push(`contract ${contract.name} {`);
  lines.push(`  version "${contract.version}";`);
  
  if (contract.license) {
    lines.push(`  license "${contract.license}";`);
  }

  // State
  if (contract.state.length > 0) {
    lines.push('');
    lines.push('  state {');
    for (const s of contract.state) {
      const init = s.initialValue ? ` = ${s.initialValue}` : '';
      lines.push(`    ${s.visibility} ${s.type} ${s.name}${init};`);
    }
    lines.push('  }');
  }

  // Events
  if (contract.events.length > 0) {
    lines.push('');
    lines.push('  events {');
    for (const e of contract.events) {
      const params = e.params.map(p => {
        const indexed = p.indexed ? ' indexed' : '';
        return `${p.type}${indexed} ${p.name}`;
      }).join(', ');
      lines.push(`    event ${e.name}(${params});`);
    }
    lines.push('  }');
  }

  // Functions
  if (contract.functions.length > 0) {
    lines.push('');
    lines.push('  behaviors {');
    for (const fn of contract.functions) {
      const params = fn.params.map(p => `${p.type} ${p.name}`).join(', ');
      const returns = fn.returns.length > 0
        ? ` -> (${fn.returns.map(r => `${r.type} ${r.name}`).join(', ')})`
        : '';
      
      lines.push(`    function ${fn.name}(${params}) ${fn.visibility} ${fn.mutability}${returns} {`);
      
      if (fn.preconditions) {
        for (const pre of fn.preconditions) {
          lines.push(`      require ${pre};`);
        }
      }
      
      if (fn.postconditions) {
        for (const post of fn.postconditions) {
          lines.push(`      ensure ${post};`);
        }
      }
      
      lines.push('    }');
    }
    lines.push('  }');
  }

  // Invariants
  if (contract.invariants.length > 0) {
    lines.push('');
    lines.push('  invariants {');
    for (const inv of contract.invariants) {
      const critical = inv.critical ? ' @critical' : '';
      lines.push(`    ${inv.name}: ${inv.expression};${critical}`);
    }
    lines.push('  }');
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Example ISL contract specification
 */
export const exampleContractISL = `
contract Token {
  version "1.0.0";
  license "MIT";

  state {
    private mapping(address => uint256) balances;
    private uint256 totalSupply;
    public string name = "ISL Token";
    public string symbol = "ISL";
    public uint8 decimals = 18;
  }

  events {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
  }

  behaviors {
    function transfer(address to, uint256 amount) public nonpayable -> (bool success) {
      require balances[msg.sender] >= amount;
      require to != address(0);
      ensure balances[msg.sender] == old(balances[msg.sender]) - amount;
      ensure balances[to] == old(balances[to]) + amount;
    }

    function balanceOf(address account) public view -> (uint256 balance) {
      ensure balance == balances[account];
    }

    function mint(address to, uint256 amount) public nonpayable {
      require msg.sender == owner;
      require to != address(0);
      ensure totalSupply == old(totalSupply) + amount;
      ensure balances[to] == old(balances[to]) + amount;
    }
  }

  invariants {
    totalSupplyNonNegative: totalSupply >= 0; @critical
    balancesConsistent: sum(balances) == totalSupply; @critical
    noZeroAddressBalance: balances[address(0)] == 0;
  }
}
`;
