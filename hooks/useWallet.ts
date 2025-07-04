"use client"

import { useState, useEffect } from "react"

declare global {
  interface Window {
    ethereum?: any
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
    if (window.ethereum) {
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
    if (!window.ethereum) {
      alert("Vui lòng cài đặt MetaMask!")
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
    setAccount(null)
    setChainId(null)
  }

  const switchToEthereum = async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }], // Ethereum Mainnet
      })
    } catch (error: any) {
      console.error("Error switching network:", error)
      if (error.code === 4902) {
        alert("Vui lòng thêm mạng Ethereum vào MetaMask")
      }
    }
  }

  const switchToSepolia = async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia Testnet
      })
    } catch (error: any) {
      if (error.code === 4902) {
        // Thêm mạng Sepolia nếu chưa có
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Testnet",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://sepolia.infura.io/v3/"],
                blockExplorerUrls: ["https://sepolia.etherscan.io/"],
              },
            ],
          })
        } catch (addError) {
          console.error("Error adding network:", addError)
        }
      }
    }
  }

  const getNetworkName = (chainId: number) => {
    switch (chainId) {
      case 1:
        return "Ethereum Mainnet"
      case 11155111:
        return "Sepolia Testnet"
      case 137:
        return "Polygon Mainnet"
      default:
        return "Unknown Network"
    }
  }

  const isCorrectNetwork = chainId === 1 || chainId === 11155111 // Mainnet hoặc Sepolia

  return {
    account,
    isConnected: !!account,
    isConnecting,
    chainId,
    networkName: chainId ? getNetworkName(chainId) : null,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchToEthereum,
    switchToSepolia,
  }
}
