"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet } from "lucide-react"
import { useWallet } from "@/lib/wallet-context"

interface WalletRequiredModalProps {
  onClose?: () => void
}

export function WalletRequiredModal({ onClose }: WalletRequiredModalProps) {
  const { connectWallet } = useWallet()

  const handleConnect = async () => {
    await connectWallet()
    if (onClose) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">지갑을 등록해야합니다</CardTitle>
          <CardDescription>이 기능을 사용하려면 MetaMask 지갑 연결이 필요합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleConnect} size="lg" className="w-full">
            <Wallet className="mr-2 h-5 w-5" />
            지갑 연결하기
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline" size="lg" className="w-full bg-transparent">
              취소
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
