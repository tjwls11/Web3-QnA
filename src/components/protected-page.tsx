'use client'

import type React from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet-context'

interface ProtectedPageProps {
  children: React.ReactNode
  requireWallet?: boolean
}

export function ProtectedPage({
  children,
  requireWallet = true,
}: ProtectedPageProps) {
  const { isAuthenticated, isConnected } = useWallet()
  const router = useRouter()

  const needRedirect = !isAuthenticated || (requireWallet && !isConnected)

  useEffect(() => {
    if (needRedirect) {
      router.replace('/')
    }
  }, [needRedirect, router])

  if (needRedirect) return null
  return <>{children}</>
}
