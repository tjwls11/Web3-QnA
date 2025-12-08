'use client'

import { useEffect } from 'react'

import { useWallet } from '@/lib/wallet-context'
import { ProtectedPage } from '@/components/protected-page'
import { WalletConnectModal } from '@/components/wallet-connect-modal'
import { Card, CardContent } from '@/components/ui/card'

export default function MyPage() {
  const { isAuthenticated, isConnected } = useWallet()

  useEffect(() => {
    // 로그인은 되어 있지만 지갑 연결이 안 되어 있으면 자동으로 모달 열기
    if (isAuthenticated && !isConnected) {
      const event = new CustomEvent('openWalletModal')
      window.dispatchEvent(event)
    }
  }, [isAuthenticated, isConnected])

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">마이페이지</h1>
        <Card>
          <CardContent className="p-6">
            {/* 여기에 마이페이지 실제 콘텐츠 */}
            <p>내 활동, 내 토큰, 프로필 정보 등이 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
      </div>

      {/* 모달은 항상 렌더되게 두어야 이벤트로 열림 */}
      <WalletConnectModal />
    </ProtectedPage>
  )
}


