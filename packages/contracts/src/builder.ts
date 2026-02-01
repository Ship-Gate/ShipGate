/**
 * ISL Smart Contract Builder
 * 
 * Fluent API for building smart contracts
 */

import type {
  Contract,
  StateVariable,
  ContractFunction,
  ContractEvent,
  Modifier,
  ContractInvariant,
  FunctionParam,
  SolidityType,
  AccessControl,
  Role,
} from './types';

/**
 * Contract builder
 */
export class ContractBuilder {
  private contract: Contract;

  constructor(name: string) {
    this.contract = {
      name,
      version: '1.0.0',
      state: [],
      functions: [],
      events: [],
      modifiers: [],
      invariants: [],
    };
  }

  /**
   * Set version
   */
  version(v: string): this {
    this.contract.version = v;
    return this;
  }

  /**
   * Set description
   */
  description(desc: string): this {
    this.contract.description = desc;
    return this;
  }

  /**
   * Set license
   */
  license(lic: string): this {
    this.contract.license = lic;
    return this;
  }

  /**
   * Add state variable
   */
  state(
    name: string,
    type: SolidityType,
    options?: Partial<Omit<StateVariable, 'name' | 'type'>>
  ): this {
    this.contract.state.push({
      name,
      type,
      visibility: options?.visibility ?? 'private',
      constant: options?.constant,
      immutable: options?.immutable,
      initialValue: options?.initialValue,
      description: options?.description,
    });
    return this;
  }

  /**
   * Add function
   */
  function(name: string): FunctionBuilder {
    return new FunctionBuilder(this, name);
  }

  /**
   * Add event
   */
  event(name: string, params: ContractEvent['params']): this {
    this.contract.events.push({ name, params });
    return this;
  }

  /**
   * Add modifier
   */
  modifier(name: string, body: string, params?: FunctionParam[]): this {
    this.contract.modifiers.push({ name, body, params });
    return this;
  }

  /**
   * Add invariant
   */
  invariant(name: string, expression: string, options?: { description?: string; critical?: boolean }): this {
    this.contract.invariants.push({
      name,
      expression,
      description: options?.description,
      critical: options?.critical,
    });
    return this;
  }

  /**
   * Add dependency
   */
  depends(dep: string): this {
    if (!this.contract.dependencies) {
      this.contract.dependencies = [];
    }
    this.contract.dependencies.push(dep);
    return this;
  }

  /**
   * Internal: add function
   */
  _addFunction(fn: ContractFunction): void {
    this.contract.functions.push(fn);
  }

  /**
   * Build the contract
   */
  build(): Contract {
    return this.contract;
  }
}

/**
 * Function builder
 */
export class FunctionBuilder {
  private fn: ContractFunction;

  constructor(
    private parent: ContractBuilder,
    name: string
  ) {
    this.fn = {
      name,
      visibility: 'public',
      mutability: 'nonpayable',
      params: [],
      returns: [],
    };
  }

  /**
   * Set description
   */
  description(desc: string): this {
    this.fn.description = desc;
    return this;
  }

  /**
   * Set visibility
   */
  visibility(v: ContractFunction['visibility']): this {
    this.fn.visibility = v;
    return this;
  }

  /**
   * Set as external
   */
  external(): this {
    this.fn.visibility = 'external';
    return this;
  }

  /**
   * Set as internal
   */
  internal(): this {
    this.fn.visibility = 'internal';
    return this;
  }

  /**
   * Set as private
   */
  private(): this {
    this.fn.visibility = 'private';
    return this;
  }

  /**
   * Set mutability
   */
  mutability(m: ContractFunction['mutability']): this {
    this.fn.mutability = m;
    return this;
  }

  /**
   * Set as pure
   */
  pure(): this {
    this.fn.mutability = 'pure';
    return this;
  }

  /**
   * Set as view
   */
  view(): this {
    this.fn.mutability = 'view';
    return this;
  }

  /**
   * Set as payable
   */
  payable(): this {
    this.fn.mutability = 'payable';
    return this;
  }

  /**
   * Add parameter
   */
  param(name: string, type: SolidityType, description?: string): this {
    this.fn.params.push({ name, type, description });
    return this;
  }

  /**
   * Add return value
   */
  returns(name: string, type: SolidityType): this {
    this.fn.returns.push({ name, type });
    return this;
  }

  /**
   * Add modifier
   */
  modifier(name: string): this {
    if (!this.fn.modifiers) {
      this.fn.modifiers = [];
    }
    this.fn.modifiers.push(name);
    return this;
  }

  /**
   * Add precondition
   */
  require(condition: string): this {
    if (!this.fn.preconditions) {
      this.fn.preconditions = [];
    }
    this.fn.preconditions.push(condition);
    return this;
  }

  /**
   * Add postcondition
   */
  ensure(condition: string): this {
    if (!this.fn.postconditions) {
      this.fn.postconditions = [];
    }
    this.fn.postconditions.push(condition);
    return this;
  }

  /**
   * Set function body
   */
  body(code: string): this {
    this.fn.body = code;
    return this;
  }

  /**
   * Complete function and return to contract builder
   */
  done(): ContractBuilder {
    this.parent._addFunction(this.fn);
    return this.parent;
  }
}

/**
 * Create a new contract builder
 */
export function contract(name: string): ContractBuilder {
  return new ContractBuilder(name);
}

/**
 * Access control builder
 */
export class AccessControlBuilder {
  private config: AccessControl = {
    roles: [],
  };

  /**
   * Set default admin
   */
  defaultAdmin(address: string): this {
    this.config.defaultAdmin = address;
    return this;
  }

  /**
   * Add role
   */
  role(name: string, functions: string[], description?: string): this {
    this.config.roles.push({ name, functions, description });
    return this;
  }

  /**
   * Add role hierarchy
   */
  hierarchy(role: string, adminRole: string): this {
    if (!this.config.roleHierarchy) {
      this.config.roleHierarchy = [];
    }
    this.config.roleHierarchy.push({ role, adminRole });
    return this;
  }

  /**
   * Build access control config
   */
  build(): AccessControl {
    return this.config;
  }
}

/**
 * Create access control builder
 */
export function accessControl(): AccessControlBuilder {
  return new AccessControlBuilder();
}

/**
 * Common modifiers
 */
export const CommonModifiers = {
  onlyOwner: {
    name: 'onlyOwner',
    body: 'require(msg.sender == owner, "Not owner"); _;',
  },
  
  nonReentrant: {
    name: 'nonReentrant',
    body: 'require(!_locked, "Reentrant call"); _locked = true; _; _locked = false;',
  },
  
  whenNotPaused: {
    name: 'whenNotPaused',
    body: 'require(!paused, "Contract paused"); _;',
  },
  
  whenPaused: {
    name: 'whenPaused',
    body: 'require(paused, "Contract not paused"); _;',
  },
};

/**
 * Common invariants
 */
export const CommonInvariants = {
  totalSupplyNonNegative: {
    name: 'totalSupplyNonNegative',
    expression: 'totalSupply >= 0',
    critical: true,
  },
  
  balancesSumToTotalSupply: {
    name: 'balancesSumToTotalSupply',
    expression: 'sum(balances) == totalSupply',
    critical: true,
  },
  
  ownerNotZeroAddress: {
    name: 'ownerNotZeroAddress',
    expression: 'owner != address(0)',
    critical: true,
  },
};
