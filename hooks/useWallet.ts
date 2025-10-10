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

  // Chain ID của PharmaDNA chainlet
  const PHARMADNA_CHAIN_ID = 2759821881746000;

  const getNetworkName = (chainId: number) => {
    switch (chainId) {
      case PHARMADNA_CHAIN_ID:
        return "PharmaDNA Chainlet";
      default:
        return "Unknown Network";
    }
  };

  const isCorrectNetwork = chainId === PHARMADNA_CHAIN_ID;

  const switchToPharmaDNA = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x9ce0b1ae7a250" }], // Chain ID của PharmaDNA chainlet (2759821881746000)
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Thêm mạng PharmaDNA nếu chưa có
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x9ce0b1ae7a250", // Chain ID của PharmaDNA chainlet (2759821881746000)
                chainName: "PharmaDNA Chainlet",
                nativeCurrency: {
                  name: "PDNA",
                  symbol: "PDNA",
                  decimals: 18,
                },
                rpcUrls: ["https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io"],
                blockExplorerUrls: ["https://pharmadna-2759821881746000-1.sagaexplorer.io"],
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding PharmaDNA network:", addError);
        }
      }
    }
  };

  return {
    account,
    isConnected: !!account,
    isConnecting,
    chainId,
    networkName: chainId ? getNetworkName(chainId) : null,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchToPharmaDNA,
  }
}
