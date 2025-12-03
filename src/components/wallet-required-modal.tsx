"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, LogIn } from "lucide-react"
import { useWallet } from "@/lib/wallet-context"
import { WalletConnectModal } from "./wallet-connect-modal"

interface WalletRequiredModalProps {
  onClose?: () => void
}

export function WalletRequiredModal({ onClose }: WalletRequiredModalProps) {
  const { isAuthenticated, connectWallet } = useWallet()

  const handleConnect = async () => {
    if (!isAuthenticated) {
      // 인증되지 않았으면 WalletConnectModal이 자동으로 표시됨
      return
    }
    await connectWallet()
    if (onClose) onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {isAuthenticated ? (
                <Wallet className="h-8 w-8 text-primary" />
              ) : (
                <LogIn className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {isAuthenticated ? "지갑을 등록해야합니다" : "로그인이 필요합니다"}
            </CardTitle>
            <CardDescription>
              {isAuthenticated 
                ? "이 기능을 사용하려면 MetaMask 지갑 연결이 필요합니다"
                : "이 기능을 사용하려면 먼저 로그인해주세요"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAuthenticated ? (
              <Button onClick={handleConnect} size="lg" className="w-full">
                <Wallet className="mr-2 h-5 w-5" />
                지갑 연결하기
              </Button>
            ) : (
              <Button onClick={handleConnect} size="lg" className="w-full">
                <LogIn className="mr-2 h-5 w-5" />
                로그인하기
              </Button>
            )}
            {onClose && (
              <Button onClick={onClose} variant="outline" size="lg" className="w-full bg-transparent">
                취소
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      {!isAuthenticated && <WalletConnectModal />}
    </>
  )
}
