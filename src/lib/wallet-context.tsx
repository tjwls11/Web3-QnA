"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface WalletContextType {
  isConnected: boolean
  address: string | null
  userName: string | null
  tokenBalance: number
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  setUserName: (name: string) => void
  addTokens: (amount: number) => void
  subtractTokens: (amount: number) => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

let isConnecting = false

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [userName, setUserNameState] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState(1250)

  useEffect(() => {
    // 페이지 로드 시 이전 연결 확인
    const savedAddress = localStorage.getItem("walletAddress")
    const savedUserName = localStorage.getItem("userName")
    const savedBalance = localStorage.getItem("tokenBalance")
    if (savedAddress) {
      setIsConnected(true)
      setAddress(savedAddress)
      setUserNameState(savedUserName)
      if (savedBalance) {
        setTokenBalance(Number.parseInt(savedBalance, 10))
      }
    }
  }, [])

  const connectWallet = async () => {
    if (isConnecting) {
      console.log("[v0] Wallet connection already in progress")
      return
    }

    if (typeof window.ethereum === "undefined") {
      alert("MetaMask가 설치되어 있지 않습니다. MetaMask를 설치해주세요.")
      return
    }

    isConnecting = true

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })
      const account = accounts[0]
      setIsConnected(true)
      setAddress(account)
      localStorage.setItem("walletAddress", account)
    } catch (error: any) {
      console.error("지갑 연결 실패:", error)

      if (error.code === -32002) {
        alert("MetaMask에서 이미 연결 요청이 대기 중입니다. MetaMask 팝업을 확인해주세요.")
      } else if (error.code === 4001) {
        alert("지갑 연결이 거부되었습니다.")
      } else {
        alert("지갑 연결에 실패했습니다.")
      }
    } finally {
      isConnecting = false
    }
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAddress(null)
    setUserNameState(null)
    setTokenBalance(1250)
    localStorage.removeItem("walletAddress")
    localStorage.removeItem("userName")
    localStorage.removeItem("tokenBalance")
  }

  const setUserName = (name: string) => {
    setUserNameState(name)
    localStorage.setItem("userName", name)
  }

  const addTokens = (amount: number) => {
    setTokenBalance((prev) => {
      const newBalance = prev + amount
      localStorage.setItem("tokenBalance", newBalance.toString())
      return newBalance
    })
  }

  const subtractTokens = (amount: number) => {
    setTokenBalance((prev) => {
      const newBalance = Math.max(0, prev - amount)
      localStorage.setItem("tokenBalance", newBalance.toString())
      return newBalance
    })
  }

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        userName,
        tokenBalance,
        connectWallet,
        disconnectWallet,
        setUserName,
        addTokens,
        subtractTokens,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

declare global {
  interface Window {
    ethereum?: any
  }
}
