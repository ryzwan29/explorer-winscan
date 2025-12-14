// Smart Contract Types and Interfaces

export interface ContractInfo {
  address: string;
  name?: string;
  compiler?: string;
  compilerVersion?: string;
  optimization?: boolean;
  optimizationRuns?: number;
  evmVersion?: string;
  verified: boolean;
  verifiedAt?: string;
  license?: string;
  constructorArgs?: string;
}

export interface ContractSourceCode {
  sourceCode: string;
  abi: string;
  contractName: string;
  language?: 'Solidity' | 'Vyper';
  settings?: Record<string, any>;
}

export interface ABIItem {
  type: 'function' | 'constructor' | 'event' | 'fallback' | 'receive';
  name?: string;
  inputs?: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  constant?: boolean;
  payable?: boolean;
  anonymous?: boolean;
}

export interface ABIInput {
  name: string;
  type: string;
  indexed?: boolean;
  components?: ABIInput[];
  internalType?: string;
}

export interface ABIOutput {
  name: string;
  type: string;
  components?: ABIOutput[];
  internalType?: string;
}

export interface DecodedContractCall {
  methodId: string;
  methodName: string;
  functionSignature: string;
  params: DecodedParam[];
  rawInput: string;
}

export interface DecodedParam {
  name: string;
  type: string;
  value: any;
  displayValue: string;
}

export interface DecodedLog {
  eventName: string;
  eventSignature: string;
  params: DecodedParam[];
  address: string;
  topics: string[];
  data: string;
}

export interface ContractMethod {
  name: string;
  type: 'read' | 'write';
  inputs: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability: string;
  payable: boolean;
}

export interface ContractEvent {
  name: string;
  inputs: ABIInput[];
  anonymous: boolean;
  signature: string;
}

export interface ContractStats {
  totalTransactions: number;
  totalInternalTransactions: number;
  totalEvents: number;
  uniqueCallers: number;
  firstSeen?: string;
  lastSeen?: string;
  balance: string;
}

export interface ContractTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: string;
  status: boolean;
  method?: string;
  decodedInput?: DecodedContractCall;
}

export interface ContractInternalTransaction {
  hash: string;
  parentHash: string;
  from: string;
  to: string;
  value: string;
  type: string;
  timestamp: string;
}

export interface ContractEventLog {
  hash: string;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  timestamp: string;
  decodedEvent?: DecodedLog;
}

export interface ContractReadResult {
  success: boolean;
  result?: any;
  error?: string;
  gasUsed?: string;
}

export interface ContractWriteParams {
  methodName: string;
  params: any[];
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
}
