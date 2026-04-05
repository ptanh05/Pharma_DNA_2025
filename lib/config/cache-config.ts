/**
 * Unified React Query cache configuration for PharmaDNA
 * Use these constants across all hooks for consistent caching behavior
 *
 * Strategy:
 * - Public data (lookup, verify): short cache, fast refresh
 * - User-specific data (inventory, NFTs): medium cache, manual invalidate
 * - Admin data (users, stats): short cache, admin actions invalidate
 * - Role/auth data: short cache, wallet change triggers invalidate
 */

export const CACHE = {
  // Public / read-only data — changes rarely
  PUBLIC_DATA: {
    staleTime: 5 * 60 * 1000,   // 5 min — data is public, safe to cache
    gcTime: 30 * 60 * 1000,     // 30 min
  },

  // User wallet data (NFTs, inventory) — changes on user action
  USER_DATA: {
    staleTime: 10 * 60 * 1000,  // 10 min — safe, mutations invalidate
    gcTime: 60 * 60 * 1000,     // 60 min
  },

  // Frequently-changing data (transfer requests, pending) — needs refresh
  PENDING_DATA: {
    staleTime: 60 * 1000,       // 1 min
    gcTime: 5 * 60 * 1000,      // 5 min
  },

  // Admin data — short cache, invalidate on mutations
  ADMIN_DATA: {
    staleTime: 30 * 1000,       // 30 sec
    gcTime: 5 * 60 * 1000,      // 5 min
  },

  // Role/auth data — wallet-dependent, short stale for fast permission updates
  AUTH_DATA: {
    staleTime: 30 * 1000,       // 30 sec — short for quick role propagation
    gcTime: 5 * 60 * 1000,     // 5 min
  },

  // Long-term static data (contract info, constants) — cache aggressively
  STATIC_DATA: {
    staleTime: 60 * 60 * 1000,  // 60 min
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
  },
} as const;

// Query keys — use these constants to avoid typos and ensure consistency
export const QUERY_KEYS = {
  admin: {
    all: ['admin'] as const,
    users: () => [...QUERY_KEYS.admin.all, 'users'] as const,
    stats: () => [...QUERY_KEYS.admin.all, 'stats'] as const,
  },
  auth: {
    all: ['auth'] as const,
    user: (address: string) => [...QUERY_KEYS.auth.all, 'user', address] as const,
    role: (address: string) => [...QUERY_KEYS.auth.all, 'role', address] as const,
  },
  manufacturer: {
    all: ['manufacturer'] as const,
    nfts: (address?: string) => [...QUERY_KEYS.manufacturer.all, 'nfts', address ?? ''] as const,
    transferRequests: () => [...QUERY_KEYS.manufacturer.all, 'transfer-requests'] as const,
    milestones: () => [...QUERY_KEYS.manufacturer.all, 'milestones'] as const,
  },
  distributor: {
    all: ['distributor'] as const,
    nfts: (address?: string) => [...QUERY_KEYS.distributor.all, 'nfts', address ?? ''] as const,
    allNfts: () => [...QUERY_KEYS.distributor.all, 'all-nfts'] as const,
    transfers: (address?: string) => [...QUERY_KEYS.distributor.all, 'transfers', address ?? ''] as const,
    pendingRequests: (address?: string) => [...QUERY_KEYS.distributor.all, 'pending-requests', address ?? ''] as const,
  },
  pharmacy: {
    all: ['pharmacy'] as const,
    inventory: (address?: string) => [...QUERY_KEYS.pharmacy.all, 'inventory', address ?? ''] as const,
    nfts: (address?: string) => [...QUERY_KEYS.pharmacy.all, 'nfts', address ?? ''] as const,
    pendingCount: (address?: string) => [...QUERY_KEYS.pharmacy.all, 'pending-count', address ?? ''] as const,
    transfers: (address?: string) => [...QUERY_KEYS.pharmacy.all, 'transfers', address ?? ''] as const,
  },
  public: {
    all: ['public'] as const,
    lookup: (code: string) => [...QUERY_KEYS.public.all, 'lookup', code] as const,
    verify: (code: string) => [...QUERY_KEYS.public.all, 'verify', code] as const,
    product: (nftId: string) => [...QUERY_KEYS.public.all, 'product', nftId] as const,
    checkExpiry: (nftId: string) => [...QUERY_KEYS.public.all, 'check-expiry', nftId] as const,
  },
  nft: {
    all: ['nft'] as const,
    info: (nftId: string) => [...QUERY_KEYS.nft.all, 'info', nftId] as const,
    expiry: (nftId: string) => [...QUERY_KEYS.nft.all, 'expiry', nftId] as const,
    balance: (address: string) => [...QUERY_KEYS.nft.all, 'balance', address] as const,
    tokens: (address: string) => [...QUERY_KEYS.nft.all, 'tokens', address] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (address: string, role: string) => [...QUERY_KEYS.notifications.all, address, role] as const,
  },
} as const;

// Prefetch staggers — delay between prefetch calls to avoid overwhelming the server
export const PREFETCH_STAGGER_MS = 100;
