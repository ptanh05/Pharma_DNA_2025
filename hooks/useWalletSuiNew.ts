/**
 * Wallet Hook for Pharma DNA Saga
 * Modern wallet connection using @mysten/dapp-kit patterns
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { WalletAdapter, WalletAdapterConfig } from '@mysten/wallet-adapter-base';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

// Wallet types
export interface WalletState {
    connected: boolean;
    address: string | null;
    chainId: string;
    balance: string;
    error: string | null;
}

export interface WalletContextValue extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => void;
    signAndExecuteTransaction: (transaction: any) => Promise<{
        digest: string;
        success: boolean;
        error?: string;
    }>;
    isAdmin: boolean;
    role: number;
}

// Default state
const defaultState: WalletState = {
    connected: false,
    address: null,
    chainId: 'unknown',
    balance: '0',
    error: null,
};

// Role constants (matching Move contract)
export const Role = {
    NONE: 0,
    MANUFACTURER: 1,
    DISTRIBUTOR: 2,
    PHARMACY: 3,
    ADMIN: 99,
} as const;

// Create context
const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Wallet Provider Component
 */
export function WalletProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WalletState>(defaultState);
    const [wallet, setWallet] = useState<any>(null);
    const [role, setRole] = useState<number>(Role.NONE);

    // Initialize wallet
    useEffect(() => {
        const initWallet = async () => {
            try {
                // Check if wallet extension is available
                if (typeof window !== 'undefined' && (window as any).suilink) {
                    const walletProvider = (window as any).suilink;
                    setWallet(walletProvider);

                    // Check if already connected
                    if (walletProvider.isConnected()) {
                        const address = await walletProvider.getAddress();
                        const chainId = await walletProvider.getChainId();

                        setState({
                            connected: true,
                            address,
                            chainId,
                            balance: '0',
                            error: null,
                        });

                        // Fetch balance
                        fetchBalance(address);
                    }
                }
            } catch (error) {
                console.error('Wallet initialization error:', error);
                setState(prev => ({
                    ...prev,
                    error: 'Wallet initialization failed',
                }));
            }
        };

        initWallet();
    }, []);

    // Fetch balance
    const fetchBalance = async (address: string) => {
        try {
            const client = new SuiClient({ url: getFullnodeUrl('testnet') });
            const balance = await client.getBalance({ owner: address });
            setState(prev => ({
                ...prev,
                balance: balance.totalBalance,
            }));
        } catch (error) {
            console.error('Error fetching balance:', error);
        }
    };

    // Connect wallet
    const connect = useCallback(async () => {
        setState(prev => ({ ...prev, error: null }));

        try {
            if (wallet) {
                await wallet.connect();
                const address = await wallet.getAddress();
                const chainId = await wallet.getChainId();

                setState({
                    connected: true,
                    address,
                    chainId,
                    balance: '0',
                    error: null,
                });

                fetchBalance(address);
            } else {
                throw new Error('No wallet available');
            }
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: error.message || 'Failed to connect wallet',
            }));
        }
    }, [wallet]);

    // Disconnect wallet
    const disconnect = useCallback(() => {
        if (wallet) {
            wallet.disconnect();
        }
        setState(defaultState);
        setRole(Role.NONE);
    }, [wallet]);

    // Sign and execute transaction
    const signAndExecuteTransaction = useCallback(async (transaction: any) => {
        if (!wallet || !state.connected) {
            return {
                digest: '',
                success: false,
                error: 'Wallet not connected',
            };
        }

        try {
            const result = await wallet.signAndExecuteTransaction({
                transaction,
            });

            if (result.digest) {
                return {
                    digest: result.digest,
                    success: true,
                };
            } else {
                return {
                    digest: '',
                    success: false,
                    error: result.errors?.[0]?.message || 'Transaction failed',
                };
            }
        } catch (error: any) {
            return {
                digest: '',
                success: false,
                error: error.message || 'Transaction failed',
            };
        }
    }, [wallet, state.connected]);

    // Check if admin
    const isAdmin = role === Role.ADMIN;

    // Fetch role on connection
    useEffect(() => {
        if (state.connected && state.address) {
            fetchRole(state.address);
        }
    }, [state.connected, state.address]);

    // Fetch role from blockchain
    const fetchRole = async (address: string) => {
        try {
            const client = new SuiClient({ url: getFullnodeUrl('testnet') });
            const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
            const contractObjectId = process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID || '';

            if (!packageId || !contractObjectId) {
                console.warn('Contract IDs not configured');
                return;
            }

            const tx = new TransactionBlock();
            tx.moveCall({
                target: `${packageId}::pharma_nft::get_role`,
                arguments: [
                    tx.object(contractObjectId),
                    tx.pure(address),
                ],
            });

            const result = await client.dryRunTransactionBlock({
                transactionBlock: await tx.build({ client }),
            });

            if (result.effects.status.status === 'success' && result.returnValues) {
                const roleValue = result.returnValues[0]?.value;
                if (roleValue) {
                    setRole(Number(roleValue));
                }
            }
        } catch (error) {
            console.error('Error fetching role:', error);
        }
    };

    const value: WalletContextValue = {
        ...state,
        connect,
        disconnect,
        signAndExecuteTransaction,
        isAdmin,
        role,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

/**
 * Use wallet context
 */
export function useWallet(): WalletContextValue {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within WalletProvider');
    }
    return context;
}

/**
 * Use wallet connection status
 */
export function useWalletConnection() {
    const { connected, address, chainId, balance } = useWallet();
    return { connected, address, chainId, balance };
}

/**
 * Use wallet address
 */
export function useWalletAddress(): string | null {
    const { address } = useWallet();
    return address;
}

/**
 * Use wallet role
 */
export function useWalletRole(): {
    role: number;
    isManufacturer: boolean;
    isDistributor: boolean;
    isPharmacy: boolean;
    isAdmin: boolean;
} {
    const { role, isAdmin } = useWallet();
    return {
        role,
        isManufacturer: role === Role.MANUFACTURER,
        isDistributor: role === Role.DISTRIBUTOR,
        isPharmacy: role === Role.PHARMACY,
        isAdmin,
    };
}

/**
 * Transaction hook
 */
export function useTransaction() {
    const { signAndExecuteTransaction, connected, address } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (
        transaction: any,
        options?: { onSuccess?: (digest: string) => void; onError?: (error: string) => void }
    ) => {
        if (!connected || !address) {
            const err = 'Wallet not connected';
            setError(err);
            options?.onError?.(err);
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await signAndExecuteTransaction(transaction);

            if (result.success) {
                options?.onSuccess?.(result.digest);
                return result.digest;
            } else {
                const errorMessage = result.error || 'Transaction failed';
                setError(errorMessage);
                options?.onError?.(errorMessage);
                return null;
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Transaction failed';
            setError(errorMessage);
            options?.onError?.(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [signAndExecuteTransaction, connected, address]);

    return { execute, loading, error };
}

export default WalletProvider;
