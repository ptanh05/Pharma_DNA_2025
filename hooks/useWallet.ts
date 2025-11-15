"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getChainId,
  getNetworkName,
  getMetaMaskNetworkParams,
} from "@/lib/blockchain/config"

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, handler: (...args: any[]) => void) => void
      removeListener: (event: string, handler: (...args: any[]) => void) => void
      isMetaMask?: boolean
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

  // Kiểm tra kết nối ví khi component mount
  useEffect(() => {
    checkConnection()

    if (window.ethereum) {
      // Lắng nghe sự kiện thay đổi tài khoản
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      // Lắng nghe sự kiện thay đổi mạng
      window.ethereum.on("chainChanged", handleChainChanged)
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  const checkConnection = async () => {
    // Check NeoLine first (Neo N3)
    if (window.neo) {
      try {
        const account = await window.neo.getAccount()
        if (account?.address) {
          setAccount(account.address)
          // Neo doesn't use chainId like EVM
          setChainId(TARGET_CHAIN_ID)
        }
      } catch (error) {
        console.error("Error checking NeoLine connection:", error)
      }
    }
    // Fallback to MetaMask (for backward compatibility, though Neo doesn't support it)
    else if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setAccount(accounts[0])
          const chainId = await window.ethereum.request({ method: "eth_chainId" })
          setChainId(Number.parseInt(chainId, 16))
        }
      } catch (error) {
        console.error("Error checking connection:", error)
      }
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAccount(accounts[0])
    } else {
      setAccount(null)
    }
  }

  const handleChainChanged = (chainId: string) => {
    setChainId(Number.parseInt(chainId, 16))
    // Reload trang khi thay đổi mạng để tránh lỗi
    window.location.reload()
  }

  const connectWallet = async () => {
    // Try NeoLine first (Neo N3)
    if (window.neo) {
      setIsConnecting(true)
      try {
        const account = await window.neo.getAccount()
        if (account?.address) {
          setAccount(account.address)
          setChainId(TARGET_CHAIN_ID)
        } else {
          alert("Không thể lấy địa chỉ từ NeoLine. Vui lòng mở NeoLine và thử lại.")
        }
      } catch (error: any) {
        console.error("Error connecting NeoLine:", error)
        if (error.code === 4001 || error.message?.includes("rejected")) {
          alert("Bạn đã từ chối kết nối ví")
        } else {
          alert("Có lỗi xảy ra khi kết nối NeoLine. Vui lòng đảm bảo NeoLine đã được cài đặt.")
        }
      } finally {
        setIsConnecting(false)
      }
      return
    }

    // Fallback to MetaMask (for backward compatibility)
    if (!window.ethereum) {
      alert("Vui lòng cài đặt NeoLine hoặc MetaMask!")
      return
    }

    setIsConnecting(true)
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length > 0) {
        setAccount(accounts[0])
        const chainId = await window.ethereum.request({ method: "eth_chainId" })
        setChainId(Number.parseInt(chainId, 16))
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error)
      if (error.code === 4001) {
        alert("Bạn đã từ chối kết nối ví")
      } else {
        alert("Có lỗi xảy ra khi kết nối ví")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    try {
      setAccount(null)
      setChainId(null)
      if (window.ethereum && window.ethereum.request) {
        window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
          .then(() => {
            // Reset state after disconnect
            setAccount(null)
            setChainId(null)
          })
          .catch((error: unknown) => {
            console.error("Error disconnecting wallet:", error)
          })
      }
    }
    catch (error) {
      console.error("Error disconnecting wallet:", error)
    }
  }

  // Get target network config
  const TARGET_CHAIN_ID = getChainId();

  const getNetworkNameFromChainId = useCallback((chainId: number | null): string | null => {
    if (!chainId) return null;
    if (chainId === TARGET_CHAIN_ID) {
      return getNetworkName();
    }
    return "Unknown Network";
  }, []);

  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const switchToTargetNetwork = useCallback(async () => {
    if (!window.ethereum) {
      alert("Vui lòng cài đặt MetaMask!");
      return;
    }

    try {
      const networkParams = getMetaMaskNetworkParams();
      const chainIdHex = networkParams.chainId;

      // Try to switch network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: any) {
      // Network not added, add it
      if (error.code === 4902) {
        try {
          const networkParams = getMetaMaskNetworkParams();
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [networkParams],
          });
        } catch (addError: any) {
          console.error("Error adding network:", addError);
          alert(
            `Không thể thêm mạng ${getNetworkName()}. Vui lòng thêm thủ công trong MetaMask.`
          );
        }
      } else if (error.code === 4001) {
        // User rejected
        console.log("User rejected network switch");
      } else {
        console.error("Error switching network:", error);
        alert("Có lỗi xảy ra khi chuyển mạng");
      }
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
