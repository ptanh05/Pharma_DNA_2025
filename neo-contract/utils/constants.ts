/**
 * Neo N3 Contract Constants
 */

export const NEO_NETWORKS = {
  MAINNET: {
    name: 'Neo N3 Mainnet',
    rpc: 'https://seed1.neo.org:10331',
    explorer: 'https://neoscan.io',
    chainId: 860833102,
    networkMagic: 56753,
  },
  TESTNET: {
    name: 'Neo N3 Testnet',
    rpc: 'https://seed1t5.neo.org:20331',
    explorer: 'https://testnet.neoscan.io',
    chainId: 844378958,
    networkMagic: 56753,
  },
};

export const CONTRACT_ROLES = {
  NONE: 0,
  MANUFACTURER: 1,
  DISTRIBUTOR: 2,
  PHARMACY: 3,
  ADMIN: 4,
} as const;

export const ROLE_NAMES: Record<number, string> = {
  0: 'None',
  1: 'Manufacturer',
  2: 'Distributor',
  3: 'Pharmacy',
  4: 'Admin',
};

export const NEP11_METHODS = {
  SYMBOL: 'symbol',
  DECIMALS: 'decimals',
  TOTAL_SUPPLY: 'totalSupply',
  BALANCE_OF: 'balanceOf',
  OWNER_OF: 'ownerOf',
  TOKENS_OF: 'tokensOf',
  TRANSFER: 'transfer',
  PROPERTIES: 'properties',
} as const;

export const CONTRACT_METHODS = {
  // Role Management
  ASSIGN_ROLE: 'assign_role',
  REVOKE_ROLE: 'revoke_role',
  GET_USER_ROLE: 'get_user_role',
  HAS_ROLE: 'has_role',
  
  // NFT Lifecycle
  MINT_PRODUCT_NFT: 'mint_product_nft',
  BATCH_MINT_PRODUCT_NFT: 'batch_mint_product_nft',
  TRANSFER_PRODUCT_NFT: 'transfer_product_nft',
  ADMIN_TRANSFER: 'admin_transfer',
  
  // View Functions
  GET_PRODUCT_CURRENT_OWNER: 'get_product_current_owner',
  NEXT_TOKEN_ID: 'next_token_id',
  TOTAL_MINTED: 'total_minted',
  IS_PRODUCT_EXPIRED: 'is_product_expired',
  
  // Admin Functions
  PAUSE: 'pause',
  UNPAUSE: 'unpause',
  UPDATE_PRODUCT_EXPIRY: 'update_product_expiry',
  MARK_PRODUCT_EXPIRED: 'mark_product_expired',
  SET_TRANSFER_RESTRICTIONS: 'set_transfer_restrictions',
} as const;

