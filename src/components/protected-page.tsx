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
  const { isConnected } = useWallet()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setShowModal(true)
    }
  }, [isConnected])

  const handleModalClose = () => {
    setShowModal(false)
    router.push("/")
  }

  if (!isConnected && showModal) {
    return <WalletRequiredModal onClose={handleModalClose} />
  }

  return <>{children}</>
}
