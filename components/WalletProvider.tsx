"use client"

import { WalletKitProvider } from '@mysten/wallet-kit';
import { getSuiNetworkConfig } from '@/lib/blockchain/config-sui';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const networkConfig = getSuiNetworkConfig();
  
  // FIXED: Remove networks prop - not supported in current wallet-kit version
  return (
    <WalletKitProvider
      features={['sui:signAndExecuteTransactionBlock']}
    >
      {children}
    </WalletKitProvider>
  );
}

