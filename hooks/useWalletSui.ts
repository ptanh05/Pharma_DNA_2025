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
      // Đóng modal khi đã kết nối thành công (sau khi user ký trong extension)
      console.log('[useWalletSui] Đã kết nối thành công sau khi user ký, đóng modal');
      setShowConnectModal(false);
      setIsWaitingForSignature(false);
    } else {
      setAccount(null);
    }
  }, [currentAccount]);

  // Track khi user chọn ví từ modal (sẽ trigger extension popup để ký)
  useEffect(() => {
    if (showConnectModal && currentWallet && !currentAccount) {
      // User đã chọn ví từ modal, đang chờ user ký trong extension
      console.log('[useWalletSui] User đã chọn ví:', currentWallet.name);
      console.log('[useWalletSui] Đang chờ user ký/approve trong extension...');
      setIsWaitingForSignature(true);
    }
  }, [showConnectModal, currentWallet, currentAccount]);

  // Update available wallets
  useEffect(() => {
    if (wallets) {
      setAvailableWallets(wallets.map((w: any) => w.name));
      console.log('[useWalletSui] Available wallets:', wallets.map((w: any) => w.name));
    }
  }, [wallets]);

  const connectWallet = useCallback(async () => {
    console.log('[useWalletSui] ========== connectWallet CALLED ==========');
    console.log('[useWalletSui] wallets:', wallets);
    console.log('[useWalletSui] wallets.length:', wallets?.length);
    console.log('[useWalletSui] showConnectModal (before):', showConnectModal);
    
    // Luôn mở modal để user chọn ví
    // Sau khi user chọn ví từ modal, extension sẽ hiện popup xác nhận (bước ký)
    setShowConnectModal(true);
    
    console.log('[useWalletSui] Modal should be opening now...');
    console.log('[useWalletSui] ==========================================');
  }, [wallets, showConnectModal]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      setAccount(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [disconnect]);

  const switchToTargetNetwork = useCallback(async () => {
    // Sui wallets handle network switching automatically
    // This is mainly for compatibility
    if (!isConnected) {
      alert("Vui lòng kết nối ví trước!");
      return;
    }
  }, [isConnected]);

  return {
    account,
    isConnected: isConnected && !!account,
    isConnecting,
    chainId: 'sui', // Sui doesn't use numeric chain IDs
    networkName: 'Sui Network',
    isCorrectNetwork: true, // Sui wallets handle this automatically
    walletType: currentWallet?.name || null,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchToTargetNetwork,
    showConnectModal,
    setShowConnectModal,
    isWaitingForSignature, // Trạng thái đang chờ user ký trong extension
    // Các hàm ký transaction (chỉ dùng khi thực hiện action như mint, transfer)
    signAndExecuteTransactionBlock, // Ký và thực thi transaction ngay
    signTransactionBlock, // Chỉ ký, không thực thi (để gửi sau)
    signMessage, // Ký message (không phải transaction)
  }
}

