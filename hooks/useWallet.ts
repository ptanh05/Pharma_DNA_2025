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

  // Import blockchain config
  const getNetworkConfig = () => {
    // Check environment variable to determine network
    const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "saga";
    
    if (network === "spoonos") {
      return {
        chainId: parseInt(process.env.NEXT_PUBLIC_SPOONOS_CHAIN_ID || "12345"),
        name: "SpoonOS",
        rpcUrl: process.env.NEXT_PUBLIC_SPOONOS_RPC || "https://rpc.spoonos.io",
        explorer: process.env.NEXT_PUBLIC_SPOONOS_EXPLORER || "https://explorer.spoonos.io",
        nativeCurrency: {
          name: process.env.NEXT_PUBLIC_SPOONOS_NATIVE_CURRENCY_NAME || "SPOON",
          symbol: process.env.NEXT_PUBLIC_SPOONOS_NATIVE_CURRENCY_SYMBOL || "SPOON",
          decimals: 18,
        },
      };
    }
    
    // Default to Saga
    return {
      chainId: 2759821881746000,
      name: "PharmaDNA Chainlet",
      rpcUrl: "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io",
      explorer: "https://pharmadna-2759821881746000-1.sagaexplorer.io",
      nativeCurrency: {
        name: "PDNA",
        symbol: "PDNA",
        decimals: 18,
      },
    };
  };

  const networkConfig = getNetworkConfig();
  const TARGET_CHAIN_ID = networkConfig.chainId;

  const getNetworkName = (chainId: number) => {
    if (chainId === TARGET_CHAIN_ID) {
      return networkConfig.name;
    }
    if (chainId === 2759821881746000) {
      return "PharmaDNA Chainlet";
    }
    return "Unknown Network";
  };

  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const switchToTargetNetwork = async () => {
    if (!window.ethereum) return;
    try {
      const chainIdHex = `0x${TARGET_CHAIN_ID.toString(16)}`;
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Thêm mạng nếu chưa có
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${TARGET_CHAIN_ID.toString(16)}`,
                chainName: networkConfig.name,
                nativeCurrency: networkConfig.nativeCurrency,
                rpcUrls: [networkConfig.rpcUrl],
                blockExplorerUrls: [networkConfig.explorer],
              },
            ],
          });
        } catch (addError) {
          console.error(`Error adding ${networkConfig.name} network:`, addError);
        }
      }
    }
  };

  // Keep old function name for backward compatibility
  const switchToPharmaDNA = switchToTargetNetwork;

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
