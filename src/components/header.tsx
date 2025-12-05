'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, Wallet, User, Menu, Plus, LogIn } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/wallet-context'
import { WalletConnectModal } from './wallet-connect-modal'

export function Header() {
  const { 
    isAuthenticated, 
    isConnected, 
    address, 
    userName, 
    connectWallet, 
    disconnectWallet,
    switchAccount,
    signOut,
  } = useWallet()
  const [notifications, setNotifications] = useState(0)
  const [notificationItems, setNotificationItems] = useState<
    Array<{
      id: string
      type: string
      title: string
      message: string
      questionId: string | null
      tags: string[]
      createdAt: number
    }>
  >([])

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications')
        if (!response.ok) {
          setNotifications(0)
          setNotificationItems([])
          return
        }
        const data = await response.json()
        const items = Array.isArray(data.notifications) ? data.notifications : []
        setNotificationItems(items)
        setNotifications(items.length)
      } catch (error) {
        console.error('[알림] 조회 실패:', error)
        setNotifications(0)
        setNotificationItems([])
      }
    }

    if (isAuthenticated) {
      loadNotifications()
    } else {
      setNotifications(0)
      setNotificationItems([])
    }
  }, [isAuthenticated])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/60">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 네비게이션 */}
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              질문 목록
            </Link>
            <Link
              href="/my-page"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              마이페이지
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              리더보드
            </Link>
          </nav>

          {/* 액션 버튼들 */}
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:flex">
              <Link href="/ask">
                <Plus className="mr-2 h-4 w-4" />
                질문하기
              </Link>
            </Button>

            {/* 알림 */}
            {isConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {notifications > 0 && (
                      <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
                        {notifications}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>알림</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationItems.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      알림이 없습니다.
                    </div>
                  ) : (
                    notificationItems.map((item) => (
                      <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-1">
                        <p className="text-sm font-medium">
                          {item.type === 'interest-tag-question'
                            ? '관심 태그 새 질문'
                            : item.title || '알림'}
                        </p>
                      <p className="text-xs text-muted-foreground">
                          {item.message ||
                            (item.type === 'interest-tag-question'
                              ? '관심 태그와 관련된 새 질문이 등록되었습니다.'
                              : '')}
                      </p>
                  </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!isAuthenticated ? (
              <>
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => {
                    // WalletConnectModal이 자동으로 열리도록 함
                    const event = new CustomEvent('openWalletModal')
                    window.dispatchEvent(event)
                  }}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline-block">로그인</span>
                </Button>
                <WalletConnectModal />
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-transparent"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline-block">
                      {userName || '프로필'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>내 계정</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/my-page">마이페이지</Link>
                  </DropdownMenuItem>
                  {isConnected && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={switchAccount}>
                        <Wallet className="mr-2 h-4 w-4" />
                        계정 전환
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={disconnectWallet}>
                        지갑 연결 해제
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 모바일 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/">질문 목록</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-page">마이페이지</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/leaderboard">리더보드</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/ask">질문하기</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
