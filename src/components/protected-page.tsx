"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/lib/wallet-context"
import { WalletRequiredModal } from "@/components/wallet-required-modal"

interface ProtectedPageProps {
  children: React.ReactNode
}

export function ProtectedPage({ children }: ProtectedPageProps) {
  const { isAuthenticated, isConnected } = useWallet()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // 로그인을 먼저 체크
    if (!isAuthenticated) {
      setShowModal(true)
    } else if (!isConnected) {
      // 로그인은 했지만 지갑이 연결되지 않은 경우
      setShowModal(true)
    }
  }, [isAuthenticated, isConnected])

  const handleModalClose = () => {
    setShowModal(false)
    router.push("/")
  }

  if ((!isAuthenticated || !isConnected) && showModal) {
    return <WalletRequiredModal onClose={handleModalClose} />
  }

  return <>{children}</>
}
