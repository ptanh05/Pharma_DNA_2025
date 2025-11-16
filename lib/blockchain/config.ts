/**
 * Blockchain Network Configuration
 * Centralized configuration for Neo N3 network
 */

export interface NetworkConfig {
  rpc: string;
  chainId: number;
  explorer: string;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}


// Neo N3 Testnet Configuration
const NEO_TESTNET_CONFIG: NetworkConfig = {
  rpc: process.env.NEO_TESTNET_RPC || process.env.NEXT_PUBLIC_NEO_TESTNET_RPC || "https://seed1t5.neo.org:20331",
  chainId: Number(process.env.NEO_TESTNET_CHAIN_ID || process.env.NEXT_PUBLIC_NEO_TESTNET_CHAIN_ID || "844378958"),
  explorer: process.env.NEO_TESTNET_EXPLORER || process.env.NEXT_PUBLIC_NEO_TESTNET_EXPLORER || "https://testnet.neoscan.io",
  name: "Neo N3 Testnet",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 8,
  },
};

// Neo N3 Mainnet Configuration
const NEO_MAINNET_CONFIG: NetworkConfig = {
  rpc: process.env.NEO_RPC || process.env.NEXT_PUBLIC_NEO_RPC || "https://seed1.neo.org:10331",
  chainId: Number(process.env.NEO_CHAIN_ID || process.env.NEXT_PUBLIC_NEO_CHAIN_ID || "860833102"),
  explorer: process.env.NEO_EXPLORER || process.env.NEXT_PUBLIC_NEO_EXPLORER || "https://neoscan.io",
  name: "Neo N3 Mainnet",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 8,
  },
};

/**
 * Get current network configuration based on BLOCKCHAIN_NETWORK env var
 */
export function getNetworkConfig(): NetworkConfig {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "neo-testnet";
  
  if (network === "neo" || network === "neo-mainnet") {
    return NEO_MAINNET_CONFIG;
  }
  
  // Default to testnet
  return NEO_TESTNET_CONFIG;
}

/**
 * Get RPC URL for current network
 */
export function getRpcUrl(): string {
  return getNetworkConfig().rpc;
}

/**
 * Get Chain ID for current network
 */
export function getChainId(): number {
  return getNetworkConfig().chainId;
}

/**
 * Get Network Name
 */
export function getNetworkName(): string {
  return getNetworkConfig().name;
}

/**
 * Get Explorer URL
 */
export function getExplorerUrl(): string {
  return getNetworkConfig().explorer;
}

/**
 * Get Explorer URL for address
 */
export function getExplorerAddressUrl(address: string): string {
  const explorer = getExplorerUrl();
  return `${explorer}/address/${address}`;
}

/**
 * Get Explorer URL for transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  const explorer = getExplorerUrl();
  return `${explorer}/tx/${txHash}`;
}


/**
 * Check if current network is Neo N3
 */
export function isNeo(): boolean {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "neo-testnet";
  return network === "neo" || network === "neo-mainnet" || network === "neo-testnet";
}

/**
 * Check if current network is Neo N3 Testnet
 */
export function isNeoTestnet(): boolean {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "neo-testnet";
  return network === "neo-testnet";
}

