"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getChainId,
  getNetworkName,
} from "@/lib/blockchain/config"

declare global {
  interface Window {
    NEOLineN3?: {
      getAccount: () => Promise<{ address: string }>
      getNetworks: () => Promise<any[]>
      getNetwork: () => Promise<any>
      invoke: (params: any) => Promise<any>
    }
    neo?: {
      getAccount: () => Promise<{ address: string }>
      getNetworks: () => Promise<any[]>
      getNetwork: () => Promise<any>
      invoke: (params: any) => Promise<any>
    }
  }
}

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)

  // Get target network config
  const TARGET_CHAIN_ID = getChainId();

  // Kiểm tra kết nối ví khi component mount
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    // Check NeoLine (Neo N3) - try NEOLineN3 first, then fallback to neo
    const neoline = window.NEOLineN3 || window.neo
    if (neoline) {
      try {
        const account = await neoline.getAccount()
        if (account?.address) {
          setAccount(account.address)
          // Neo doesn't use chainId like EVM
          setChainId(TARGET_CHAIN_ID)
        }
      } catch (error) {
        console.error("Error checking NeoLine connection:", error)
      }
    }
  }

  const connectWallet = async () => {
    // Check if NeoLine is installed - try NEOLineN3 first, then fallback to neo
    console.log("Checking for NeoLine extension...")
    console.log("window.NEOLineN3:", window.NEOLineN3)
    console.log("window.neo:", window.neo)
    
    const neoline = window.NEOLineN3 || window.neo
    if (!neoline) {
      console.error("NeoLine extension not found!")
      alert("Vui lòng cài đặt NeoLine extension để kết nối ví!\n\nTải NeoLine tại: https://neoline.io/")
      return
    }

    console.log("NeoLine found, attempting to connect...")
    setIsConnecting(true)
    try {
      const account = await neoline.getAccount()
      console.log("Account response:", account)
      if (account?.address) {
        setAccount(account.address)
        setChainId(TARGET_CHAIN_ID)
        console.log("Successfully connected to NeoLine:", account.address)
      } else {
        console.error("No address in account response:", account)
        alert("Không thể lấy địa chỉ từ NeoLine. Vui lòng mở NeoLine và thử lại.")
      }
    } catch (error: any) {
      console.error("Error connecting NeoLine:", error)
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      if (error.code === 4001 || error.message?.includes("rejected") || error.message?.includes("User rejected")) {
        alert("Bạn đã từ chối kết nối ví NeoLine")
      } else {
        alert(`Có lỗi xảy ra khi kết nối NeoLine: ${error.message || "Unknown error"}\n\nVui lòng đảm bảo NeoLine đã được cài đặt và mở.`)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    try {
      setAccount(null)
      setChainId(null)
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
    const neoline = window.NEOLineN3 || window.neo
    if (!neoline) {
      alert("Vui lòng cài đặt NeoLine extension!");
      return;
    }

    try {
      // NeoLine handles network switching automatically
      // Just check if we're on the correct network
      const network = await neoline.getNetwork();
      if (network) {
        console.log("Current network:", network);
        // NeoLine should be on Neo N3 Mainnet or Testnet
        // No need to switch like EVM chains
      }
    } catch (error: any) {
      console.error("Error checking network:", error);
      alert("Có lỗi xảy ra khi kiểm tra mạng. Vui lòng đảm bảo NeoLine đã được kết nối.");
    }
  }, []);

  return {
    account,
    isConnected: !!account,
    isConnecting,
    chainId,
    networkName: getNetworkNameFromChainId(chainId),
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchToTargetNetwork,
    // Deprecated aliases (for backward compatibility - will be removed in future)
    switchToSpoonOS: switchToTargetNetwork, // Deprecated - use switchToTargetNetwork
    switchToPharmaDNA: switchToTargetNetwork, // Deprecated - use switchToTargetNetwork
  }
}
