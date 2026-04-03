"use client"

import { useState, useEffect, useCallback } from "react"
import { useWalletKit } from '@mysten/wallet-kit';

// Sui Wallet Interface
interface SuiWallet {
  name: string;
  icon: string;
  accounts: readonly { address: string }[];
  chains: readonly { id: string; name: string }[];
  features: readonly string[];
}

export function useWalletSui() {
  const {
    currentWallet,
    currentAccount,
    connect,
    disconnect,
    isConnected,
    wallets,
    signAndExecuteTransactionBlock,
    signTransactionBlock,
    signMessage,
  } = useWalletKit();

  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isWaitingForSignature, setIsWaitingForSignature] = useState(false);

  // Update account when wallet changes
  useEffect(() => {
    if (currentAccount?.address) {
      setAccount(currentAccount.address);
      setShowConnectModal(false);
      setIsWaitingForSignature(false);
    } else {
      setAccount(null);
    }
  }, [currentAccount]);

  // Track khi user chọn ví từ modal (sẽ trigger extension popup để ký)
  useEffect(() => {
    if (showConnectModal && currentWallet && !currentAccount) {
      setIsWaitingForSignature(true);
    }
  }, [showConnectModal, currentWallet, currentAccount]);

  // Update available wallets
  useEffect(() => {
    if (wallets) {
      setAvailableWallets(wallets.map((w: any) => w.name));
    }
  }, [wallets]);

  const connectWallet = useCallback(async () => {
    setShowConnectModal(true);
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      setAccount(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [disconnect]);

  const switchToTargetNetwork = useCallback(async () => {
    if (!isConnected) {
      alert("Vui lòng kết nối ví trước!");
      return;
    }
  }, [isConnected]);

  return {
    account,
    isConnected: isConnected && !!account,
    isConnecting,
    chainId: 'sui',
    networkName: 'Sui Network',
    isCorrectNetwork: true,
    walletType: currentWallet?.name || null,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchToTargetNetwork,
    showConnectModal,
    setShowConnectModal,
    isWaitingForSignature,
    signAndExecuteTransactionBlock,
    signTransactionBlock,
    signMessage,
  }
}
