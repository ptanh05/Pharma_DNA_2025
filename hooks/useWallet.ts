"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getChainId,
  getNetworkName,
} from "@/lib/blockchain/config"

// Neo N3 Wallet Interface
interface NeoWallet {
  getAccount: () => Promise<{ address: string }>
  getNetworks?: () => Promise<any[]>
  getNetwork?: () => Promise<any>
  invoke?: (params: any) => Promise<any>
  // Flutter wallet specific
  connect?: () => Promise<any>
  disconnect?: () => Promise<any>
  // ONE wallet specific
  enable?: () => Promise<any>
  // O3 wallet specific
  request?: (params: any) => Promise<any>
}

type WalletType = 'NEOLineN3' | 'neo' | 'Flutter' | 'ONE' | 'O3' | 'unknown'

declare global {
  interface Window {
    NEOLineN3?: NeoWallet
    neo?: NeoWallet
    Flutter?: NeoWallet
    ONE?: NeoWallet
    O3?: NeoWallet
    // Generic wallet detection
    [key: string]: any
  }
}

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [walletType, setWalletType] = useState<WalletType | null>(null)
  const [availableWallets, setAvailableWallets] = useState<WalletType[]>([])

  // Get target network config
  const TARGET_CHAIN_ID = getChainId();

  // Detect available wallets
  const detectWallets = useCallback((): WalletType[] => {
    const wallets: WalletType[] = []
    
    console.log("🔍 Scanning for Neo N3 wallets...")
    console.log("window.NEOLineN3:", window.NEOLineN3)
    console.log("window.neo:", window.neo)
    console.log("window.Flutter:", window.Flutter)
    console.log("window.ONE:", window.ONE)
    console.log("window.O3:", window.O3)
    
    // Check for different wallet types
    if (window.NEOLineN3 && typeof window.NEOLineN3.getAccount === 'function') {
      wallets.push('NEOLineN3')
      console.log("✅ Found NEOLineN3")
    }
    if (window.neo && typeof window.neo.getAccount === 'function') {
      wallets.push('neo')
      console.log("✅ Found neo (legacy)")
    }
    if (window.Flutter && typeof window.Flutter.getAccount === 'function') {
      wallets.push('Flutter')
      console.log("✅ Found Flutter wallet")
    }
    // Also check for Flutter with different property names
    if (window.Flutter && (window.Flutter as any).getAccount) {
      if (!wallets.includes('Flutter')) {
        wallets.push('Flutter')
        console.log("✅ Found Flutter wallet (alternative)")
      }
    }
    if (window.ONE && typeof window.ONE.getAccount === 'function') {
      wallets.push('ONE')
      console.log("✅ Found ONE wallet")
    }
    if (window.O3 && typeof window.O3.getAccount === 'function') {
      wallets.push('O3')
      console.log("✅ Found O3 wallet")
    }
    
    // Check for any wallet-like objects in window
    for (const key in window) {
      if (key.toLowerCase().includes('flutter') || key.toLowerCase().includes('wallet')) {
        const obj = (window as any)[key]
        if (obj && typeof obj.getAccount === 'function' && !wallets.includes('Flutter')) {
          console.log(`✅ Found potential wallet: ${key}`, obj)
          // Don't auto-add, but log for debugging
        }
      }
    }
    
    console.log(`📊 Total detected wallets: ${wallets.length}`, wallets)
    return wallets
  }, [])

  // Get wallet instance by type
  const getWalletInstance = useCallback((type: WalletType): NeoWallet | null => {
    switch (type) {
      case 'NEOLineN3':
        return window.NEOLineN3 || null
      case 'neo':
        return window.neo || null
      case 'Flutter':
        return window.Flutter || null
      case 'ONE':
        return window.ONE || null
      case 'O3':
        return window.O3 || null
      default:
        return null
    }
  }, [])

  const checkConnection = useCallback(async (preferredWallet?: WalletType) => {
    const wallets = detectWallets()
    const walletsToTry = preferredWallet ? [preferredWallet] : wallets
    
    for (const walletType of walletsToTry) {
      const wallet = getWalletInstance(walletType)
      if (wallet) {
        try {
          // Some wallets need to be enabled/connected first
          if (wallet.enable) {
            await wallet.enable()
          } else if (wallet.connect) {
            await wallet.connect()
          }
          
          const account = await wallet.getAccount()
          if (account?.address) {
            setAccount(account.address)
            setChainId(TARGET_CHAIN_ID)
            setWalletType(walletType)
            console.log(`Successfully connected to ${walletType}:`, account.address)
            return
          }
        } catch (error) {
          console.log(`Failed to connect to ${walletType}:`, error)
          // Continue to next wallet
        }
      }
    }
  }, [detectWallets, getWalletInstance, TARGET_CHAIN_ID])

  // Auto-detect wallets on mount
  useEffect(() => {
    const wallets = detectWallets()
    setAvailableWallets(wallets)
    
    // Try to auto-connect with first available wallet
    if (wallets.length > 0) {
      checkConnection(wallets[0])
    }
  }, [detectWallets, checkConnection])

  const connectWallet = async (preferredWalletType?: WalletType) => {
    console.log("Checking for Neo N3 wallets...")
    
    // Detect all available wallets
    const wallets = detectWallets()
    setAvailableWallets(wallets)
    
    if (wallets.length === 0) {
      console.error("No Neo N3 wallet found!")
      alert(
        "Không tìm thấy ví Neo N3 nào!\n\n" +
        "Vui lòng cài đặt một trong các ví sau:\n" +
        "• NeoLine: https://neoline.io/\n" +
        "• Flutter Wallet\n" +
        "• ONE Wallet\n" +
        "• O3 Wallet"
      )
      return
    }

    // Use preferred wallet or try all available wallets
    const walletsToTry = preferredWalletType 
      ? [preferredWalletType] 
      : wallets

    console.log("Available wallets:", walletsToTry)
    setIsConnecting(true)
    
    let lastError: any = null
    
    for (const walletType of walletsToTry) {
      const wallet = getWalletInstance(walletType)
      if (!wallet) continue
      
      try {
        console.log(`Attempting to connect to ${walletType}...`)
        
        // Some wallets need to be enabled/connected first
        if (wallet.enable) {
          console.log(`Enabling ${walletType}...`)
          await wallet.enable()
        } else if (wallet.connect) {
          console.log(`Connecting to ${walletType}...`)
          await wallet.connect()
        }
        
        const account = await wallet.getAccount()
        console.log(`${walletType} account response:`, account)
        
        if (account?.address) {
          setAccount(account.address)
          setChainId(TARGET_CHAIN_ID)
          setWalletType(walletType)
          console.log(`✅ Successfully connected to ${walletType}:`, account.address)
          setIsConnecting(false)
          return
        } else {
          console.error(`No address in ${walletType} response:`, account)
          lastError = new Error(`Không thể lấy địa chỉ từ ${walletType}`)
        }
      } catch (error: any) {
        console.error(`Error connecting to ${walletType}:`, error)
        lastError = error
        // Continue to next wallet
      }
    }
    
    setIsConnecting(false)
    
    // If all wallets failed, show error
    if (lastError) {
      if (lastError.code === 4001 || 
          lastError.message?.includes("rejected") || 
          lastError.message?.includes("User rejected")) {
        alert("Bạn đã từ chối kết nối ví")
      } else {
        alert(
          `Không thể kết nối với bất kỳ ví nào.\n\n` +
          `Lỗi: ${lastError.message || "Unknown error"}\n\n` +
          `Vui lòng đảm bảo ví đã được cài đặt và mở.`
        )
      }
    }
  }

  const disconnectWallet = async () => {
    try {
      if (walletType) {
        const wallet = getWalletInstance(walletType)
        if (wallet?.disconnect) {
          await wallet.disconnect()
        }
      }
      setAccount(null)
      setChainId(null)
      setWalletType(null)
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
    }
  }

  const getNetworkNameFromChainId = useCallback((chainId: number | null): string | null => {
    if (!chainId) return null;
    if (chainId === TARGET_CHAIN_ID) {
      return getNetworkName();
    }
    return "Unknown Network";
  }, []);

  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const switchToTargetNetwork = useCallback(async () => {
    if (!walletType) {
      alert("Vui lòng kết nối ví trước!");
      return;
    }

    const wallet = getWalletInstance(walletType)
    if (!wallet) {
      alert("Không tìm thấy ví đã kết nối!");
      return;
    }

    try {
      // Check network if wallet supports it
      if (wallet.getNetwork) {
        const network = await wallet.getNetwork();
        console.log("Current network:", network);
        // Neo N3 wallets should be on Neo N3 Mainnet or Testnet
        // No need to switch like EVM chains
      }
    } catch (error: any) {
      console.error("Error checking network:", error);
      alert("Có lỗi xảy ra khi kiểm tra mạng. Vui lòng đảm bảo ví đã được kết nối.");
    }
  }, [walletType, getWalletInstance]);

  return {
    account,
    isConnected: !!account,
    isConnecting,
    chainId,
    networkName: getNetworkNameFromChainId(chainId),
    isCorrectNetwork,
    walletType,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchToTargetNetwork,
    // Deprecated aliases (for backward compatibility - will be removed in future)
    switchToSpoonOS: switchToTargetNetwork, // Deprecated - use switchToTargetNetwork
    switchToPharmaDNA: switchToTargetNetwork, // Deprecated - use switchToTargetNetwork
  }
}
