/**
 * ISL Smart Contract Types
 * 
 * Defines smart contract specifications for blockchain platforms
 * including Ethereum/Solidity, Solana, and cross-chain protocols.
 */

// ============================================================================
// CONTRACT DEFINITION
// ============================================================================

/**
 * Smart contract definition
 */
export interface Contract {
  name: string;
  version: string;
  description?: string;
  license?: string;
  state: StateVariable[];
  functions: ContractFunction[];
  events: ContractEvent[];
  modifiers: Modifier[];
  invariants: ContractInvariant[];
  dependencies?: string[];
}

/**
 * State variable
 */
export interface StateVariable {
  name: string;
  type: SolidityType;
  visibility: 'public' | 'private' | 'internal';
  constant?: boolean;
  immutable?: boolean;
  initialValue?: string;
  description?: string;
}

/**
 * Solidity types
 */
export type SolidityType =
  | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256'
  | 'int8' | 'int16' | 'int32' | 'int64' | 'int128' | 'int256'
  | 'bool'
  | 'address' | 'address payable'
  | 'bytes' | 'bytes1' | 'bytes32'
  | 'string'
  | `${string}[]`
  | `mapping(${string} => ${string})`;

/**
 * Contract function
 */
export interface ContractFunction {
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'internal' | 'external';
  mutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  params: FunctionParam[];
  returns: FunctionParam[];
  modifiers?: string[];
  preconditions?: string[];
  postconditions?: string[];
  body?: string;
}

/**
 * Function parameter
 */
export interface FunctionParam {
  name: string;
  type: SolidityType;
  description?: string;
}

/**
 * Contract event
 */
export interface ContractEvent {
  name: string;
  description?: string;
  params: EventParam[];
}

/**
 * Event parameter
 */
export interface EventParam {
  name: string;
  type: SolidityType;
  indexed?: boolean;
}

/**
 * Function modifier
 */
export interface Modifier {
  name: string;
  description?: string;
  params?: FunctionParam[];
  body: string;
}

/**
 * Contract invariant
 */
export interface ContractInvariant {
  name: string;
  description?: string;
  expression: string;
  critical?: boolean;
}

// ============================================================================
// SECURITY PATTERNS
// ============================================================================

/**
 * Access control configuration
 */
export interface AccessControl {
  roles: Role[];
  defaultAdmin?: string;
  roleHierarchy?: RoleHierarchy[];
}

/**
 * Role definition
 */
export interface Role {
  name: string;
  description?: string;
  functions: string[];
}

/**
 * Role hierarchy
 */
export interface RoleHierarchy {
  role: string;
  adminRole: string;
}

/**
 * Reentrancy guard configuration
 */
export interface ReentrancyGuard {
  functions: string[];
  pattern: 'checks-effects-interactions' | 'mutex';
}

/**
 * Pausable configuration
 */
export interface Pausable {
  pauseRole?: string;
  unpauseRole?: string;
  initiallyPaused?: boolean;
}

// ============================================================================
// TOKEN STANDARDS
// ============================================================================

/**
 * ERC20 token configuration
 */
export interface ERC20Config {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply?: string;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
  capped?: string;
  permit?: boolean;
  snapshots?: boolean;
}

/**
 * ERC721 NFT configuration
 */
export interface ERC721Config {
  name: string;
  symbol: string;
  baseURI?: string;
  maxSupply?: number;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
  enumerable?: boolean;
  royalties?: RoyaltyConfig;
}

/**
 * Royalty configuration
 */
export interface RoyaltyConfig {
  recipient: string;
  percentage: number; // basis points (e.g., 250 = 2.5%)
}

/**
 * ERC1155 multi-token configuration
 */
export interface ERC1155Config {
  uri: string;
  pausable?: boolean;
  supply?: boolean;
  burnable?: boolean;
}

// ============================================================================
// DEFI PATTERNS
// ============================================================================

/**
 * Token vault configuration
 */
export interface VaultConfig {
  asset: string;
  name: string;
  symbol: string;
  fees?: VaultFees;
  strategies?: string[];
}

/**
 * Vault fees
 */
export interface VaultFees {
  deposit?: number;
  withdrawal?: number;
  performance?: number;
  management?: number;
}

/**
 * Staking configuration
 */
export interface StakingConfig {
  stakingToken: string;
  rewardToken: string;
  rewardRate: string;
  lockPeriod?: number;
  unstakingPeriod?: number;
  maxStake?: string;
}

/**
 * Liquidity pool configuration
 */
export interface LiquidityPoolConfig {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing?: number;
  oracle?: boolean;
}

// ============================================================================
// GOVERNANCE
// ============================================================================

/**
 * Governor configuration
 */
export interface GovernorConfig {
  token: string;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: string;
  quorumPercentage: number;
  timelockDelay: number;
}

/**
 * Proposal
 */
export interface Proposal {
  id: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  status: ProposalStatus;
}

/**
 * Proposal status
 */
export type ProposalStatus =
  | 'pending'
  | 'active'
  | 'canceled'
  | 'defeated'
  | 'succeeded'
  | 'queued'
  | 'expired'
  | 'executed';

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Contract verification result
 */
export interface ContractVerificationResult {
  valid: boolean;
  errors: ContractError[];
  warnings: ContractWarning[];
  gasEstimates: GasEstimate[];
  securityIssues: SecurityIssue[];
}

/**
 * Contract error
 */
export interface ContractError {
  type: 'syntax' | 'type' | 'semantic' | 'invariant';
  message: string;
  location?: string;
  suggestion?: string;
}

/**
 * Contract warning
 */
export interface ContractWarning {
  type: 'gas' | 'security' | 'style' | 'optimization';
  message: string;
  location?: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Gas estimate
 */
export interface GasEstimate {
  function: string;
  min: number;
  max: number;
  average: number;
}

/**
 * Security issue
 */
export interface SecurityIssue {
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: string;
  recommendation: string;
}
