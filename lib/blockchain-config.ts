/**
 * Blockchain Network Configuration
 * Centralized config để dễ dàng switch giữa các networks
 */

// Get network từ environment variable
const BLOCKCHAIN_NETWORK = process.env.BLOCKCHAIN_NETWORK || "saga";

// SpoonOS Configuration
const SPOONOS_CONFIG = {
  name: "SpoonOS",
  chainId: parseInt(process.env.SPOONOS_CHAIN_ID || process.env.NEXT_PUBLIC_SPOONOS_CHAIN_ID || "12345"),
  rpcUrl: process.env.SPOONOS_RPC || process.env.NEXT_PUBLIC_SPOONOS_RPC || "https://rpc.spoonos.io",
  explorer: process.env.SPOONOS_EXPLORER || process.env.NEXT_PUBLIC_SPOONOS_EXPLORER || "https://explorer.spoonos.io",
  nativeCurrency: {
    name: process.env.SPOONOS_NATIVE_CURRENCY_NAME || "SPOON",
    symbol: process.env.SPOONOS_NATIVE_CURRENCY_SYMBOL || "SPOON",
    decimals: 18,
  },
};

// Saga Network Configuration
const SAGA_CONFIG = {
  name: "PharmaDNA Chainlet",
  chainId: parseInt(process.env.PHARMADNA_CHAIN_ID || "2759821881746000"),
  rpcUrl: process.env.PHARMADNA_RPC || "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io",
  explorer: process.env.PHARMADNA_EXPLORER || "https://pharmadna-2759821881746000-1.sagaexplorer.io",
  nativeCurrency: {
    name: "PDNA",
    symbol: "PDNA",
    decimals: 18,
  },
};

// Get current network config
export function getNetworkConfig() {
  if (BLOCKCHAIN_NETWORK === "spoonos") {
    return SPOONOS_CONFIG;
  }
  return SAGA_CONFIG; // Default to Saga
}

// Get RPC URL
export function getRpcUrl(): string {
  return getNetworkConfig().rpcUrl;
}

// Get Chain ID
export function getChainId(): number {
  return getNetworkConfig().chainId;
}

// Get Network Name
export function getNetworkName(): string {
  return getNetworkConfig().name;
}

// Get Explorer URL
export function getExplorerUrl(): string {
  return getNetworkConfig().explorer;
}

// Get Native Currency
export function getNativeCurrency() {
  return getNetworkConfig().nativeCurrency;
}

// Check if using SpoonOS
export function isSpoonOS(): boolean {
  return BLOCKCHAIN_NETWORK === "spoonos";
}

// Check if using Saga
export function isSaga(): boolean {
  return BLOCKCHAIN_NETWORK === "saga" || !isSpoonOS();
}

// Get chain ID in hex format for MetaMask
export function getChainIdHex(): string {
  return `0x${getChainId().toString(16)}`;
}

// Get MetaMask network params
export function getMetaMaskNetworkParams() {
  const config = getNetworkConfig();
  return {
    chainId: getChainIdHex(),
    chainName: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.explorer],
  };
}

// Export configs for reference
export { SPOONOS_CONFIG, SAGA_CONFIG, BLOCKCHAIN_NETWORK };

