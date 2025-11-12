"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Shield, Coins, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"

const wallets = [
  {
    name: "MetaMask",
    description: "가장 인기있는 이더리움 지갑",
    icon: "🦊",
    recommended: true,
  },
  {
    name: "WalletConnect",
    description: "모바일 지갑을 연결하세요",
    icon: "🔗",
    recommended: false,
  },
  {
    name: "Coinbase Wallet",
    description: "Coinbase 사용자를 위한 지갑",
    icon: "💰",
    recommended: false,
  },
]

export default function LoginPage() {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async (walletName: string) => {
    setIsConnecting(true)
    // 실제 지갑 연결 로직
    setTimeout(() => {
      setIsConnecting(false)
      alert(`${walletName} 연결 완료!`)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* 헤더 */}
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">지갑을 연결하세요</h1>
            <p className="text-pretty text-lg text-muted-foreground">
              블록체인 기반 보상 시스템을 이용하려면 지갑 연결이 필요합니다
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            {/* 지갑 선택 */}
            <div>
              <h2 className="mb-6 text-2xl font-bold">지갑 선택</h2>
              <div className="space-y-4">
                {wallets.map((wallet) => (
                  <Card
                    key={wallet.name}
                    className="relative transition-all hover:shadow-lg hover:border-primary cursor-pointer"
                    onClick={() => handleConnect(wallet.name)}
                  >
                    {wallet.recommended && (
                      <div className="absolute -right-2 -top-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        추천
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                            {wallet.icon}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{wallet.name}</CardTitle>
                            <CardDescription>{wallet.description}</CardDescription>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* 지갑이 없는 경우 */}
              <Card className="mt-6 border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">지갑이 없으신가요?</CardTitle>
                  <CardDescription>암호화폐 지갑을 처음 사용하시나요? 걱정하지 마세요!</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                      MetaMask 설치하기
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 안내 사항 */}
            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">왜 지갑이 필요한가요?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">보안</h3>
                      <p className="text-sm text-muted-foreground">
                        탈중앙화된 로그인으로 개인정보를 안전하게 보호합니다
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">토큰 보상</h3>
                      <p className="text-sm text-muted-foreground">답변 채택 시 실질적인 가치를 가진 토큰을 받습니다</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">투명성</h3>
                      <p className="text-sm text-muted-foreground">모든 거래가 블록체인에 기록되어 투명합니다</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <h4 className="mb-2 font-semibold text-sm">💡 알아두세요</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• 지갑 연결은 무료입니다</li>
                      <li>• 개인키는 절대 공유되지 않습니다</li>
                      <li>• 언제든지 연결을 해제할 수 있습니다</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 추가 안내 */}
          <div className="mt-12 rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              지갑 연결에 문제가 있으신가요?{" "}
              <Link href="/help" className="font-medium text-primary hover:underline">
                도움말 센터
              </Link>
              를 확인하세요
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
