/**
 * Sui Blockchain Network Configuration
 * Centralized configuration for Sui network
 */

export interface SuiNetworkConfig {
  rpc: string;
  faucet?: string;
  explorer: string;
  name: string;
  chainId: string;
}

// Sui Testnet Configuration
const SUI_TESTNET_CONFIG: SuiNetworkConfig = {
  rpc: process.env.SUI_TESTNET_RPC || process.env.NEXT_PUBLIC_SUI_TESTNET_RPC || "https://fullnode.testnet.sui.io:443",
  faucet: process.env.SUI_TESTNET_FAUCET || process.env.NEXT_PUBLIC_SUI_TESTNET_FAUCET || "https://faucet.testnet.sui.io/gas",
  explorer: process.env.SUI_TESTNET_EXPLORER || process.env.NEXT_PUBLIC_SUI_TESTNET_EXPLORER || "https://suiexplorer.com",
  name: "Sui Testnet",
  chainId: process.env.SUI_TESTNET_CHAIN_ID || process.env.NEXT_PUBLIC_SUI_TESTNET_CHAIN_ID || "testnet",
};

// Sui Mainnet Configuration
const SUI_MAINNET_CONFIG: SuiNetworkConfig = {
  rpc: process.env.SUI_RPC || process.env.NEXT_PUBLIC_SUI_RPC || "https://fullnode.mainnet.sui.io:443",
  explorer: process.env.SUI_EXPLORER || process.env.NEXT_PUBLIC_SUI_EXPLORER || "https://suiexplorer.com",
  name: "Sui Mainnet",
  chainId: process.env.SUI_CHAIN_ID || process.env.NEXT_PUBLIC_SUI_CHAIN_ID || "mainnet",
};

// Sui Devnet Configuration
const SUI_DEVNET_CONFIG: SuiNetworkConfig = {
  rpc: process.env.SUI_DEVNET_RPC || process.env.NEXT_PUBLIC_SUI_DEVNET_RPC || "https://fullnode.devnet.sui.io:443",
  faucet: process.env.SUI_DEVNET_FAUCET || process.env.NEXT_PUBLIC_SUI_DEVNET_FAUCET || "https://faucet.devnet.sui.io/gas",
  explorer: process.env.SUI_DEVNET_EXPLORER || process.env.NEXT_PUBLIC_SUI_DEVNET_EXPLORER || "https://suiexplorer.com",
  name: "Sui Devnet",
  chainId: process.env.SUI_DEVNET_CHAIN_ID || process.env.NEXT_PUBLIC_SUI_DEVNET_CHAIN_ID || "devnet",
};

/**
 * Get current network configuration based on BLOCKCHAIN_NETWORK env var
 */
export function getSuiNetworkConfig(): SuiNetworkConfig {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "sui-testnet";
  
  if (network === "sui" || network === "sui-mainnet") {
    return SUI_MAINNET_CONFIG;
  }
  
  if (network === "sui-devnet") {
    return SUI_DEVNET_CONFIG;
  }
  
  // Default to testnet
  return SUI_TESTNET_CONFIG;
}

/**
 * Get RPC URL for current network
 */
export function getSuiRpcUrl(): string {
  return getSuiNetworkConfig().rpc;
}

/**
 * Get Chain ID for current network
 */
export function getSuiChainId(): string {
  return getSuiNetworkConfig().chainId;
}

/**
 * Get Network Name
 */
export function getSuiNetworkName(): string {
  return getSuiNetworkConfig().name;
}

/**
 * Get Explorer URL
 */
export function getSuiExplorerUrl(): string {
  return getSuiNetworkConfig().explorer;
}

/**
 * Get Explorer URL for address
 */
export function getSuiExplorerAddressUrl(address: string): string {
  const explorer = getSuiExplorerUrl();
  return `${explorer}/address/${address}`;
}

/**
 * Get Explorer URL for transaction
 */
export function getSuiExplorerTxUrl(txDigest: string): string {
  const explorer = getSuiExplorerUrl();
  return `${explorer}/txblock/${txDigest}`;
}

/**
 * Get Explorer URL for object
 */
export function getSuiExplorerObjectUrl(objectId: string): string {
  const explorer = getSuiExplorerUrl();
  return `${explorer}/object/${objectId}`;
}

/**
 * Check if current network is Sui
 */
export function isSui(): boolean {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "sui-testnet";
  return network.startsWith("sui");
}

/**
 * Check if current network is Sui Testnet
 */
export function isSuiTestnet(): boolean {
  const network = process.env.BLOCKCHAIN_NETWORK || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "sui-testnet";
  return network === "sui-testnet";
}

