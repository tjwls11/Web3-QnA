'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, LogIn, UserPlus, AlertCircle } from 'lucide-react'
import { useWallet } from '@/lib/wallet-context'
import {
  getBrowserProvider,
  checkNetwork,
  switchNetwork,
} from '@/lib/web3/provider'
import { NETWORK_CONFIG } from '@/lib/web3/config'

type ModalView = 'auth' | 'wallet' | 'name'

export function WalletConnectModal() {
  const {
    isAuthenticated,
    isConnected,
    userName: currentUserName,
    isRegistered,
    signUp,
    signIn,
    connectWallet,
    registerUser,
  } = useWallet()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<ModalView>('auth')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signUpUserName, setSignUpUserName] = useState('') // 회원가입 시 닉네임
  const [nameValue, setNameValue] = useState('') // 지갑 연결 후 이름 (사용 안 함)
  const [isLoading, setIsLoading] = useState(false)
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(
    null
  )
  const [currentNetwork, setCurrentNetwork] = useState<string | null>(null)
  const [isWrongNetwork, setIsWrongNetwork] = useState(false)

  // 유저의 지갑 주소 확인 및 네트워크 확인
  useEffect(() => {
    const checkUserWallet = async () => {
      if (!isAuthenticated) {
        setUserWalletAddress(null)
        return
      }

      try {
        const response = await fetch('/api/auth/user-wallet')
        if (response.ok) {
          const data = await response.json()
          setUserWalletAddress(data.walletAddress)
        }
      } catch (error) {
        console.error('지갑 주소 확인 실패:', error)
        setUserWalletAddress(null)
      }
    }

    const checkNetworkStatus = async () => {
      if (typeof window === 'undefined' || !window.ethereum) {
        setCurrentNetwork(null)
        setIsWrongNetwork(false)
        return
      }

      try {
        const provider = getBrowserProvider()
        if (!provider) {
          setCurrentNetwork(null)
          setIsWrongNetwork(false)
          return
        }

        const network = await provider.getNetwork()
        const chainId = Number(network.chainId)
        const isCorrect = chainId === NETWORK_CONFIG.chainId

        // 네트워크 이름 매핑
        const networkNames: Record<number, string> = {
          1: 'Ethereum Mainnet',
          11155111: 'Sepolia',
          5: 'Goerli',
          137: 'Polygon',
          80001: 'Mumbai',
        }

        setCurrentNetwork(networkNames[chainId] || `Chain ${chainId}`)
        setIsWrongNetwork(!isCorrect)
      } catch (error) {
        console.error('네트워크 확인 실패:', error)
        setCurrentNetwork(null)
        setIsWrongNetwork(false)
      }
    }

    checkUserWallet()
    checkNetworkStatus()

    // 네트워크 변경 감지
    if (window.ethereum) {
      const handleChainChanged = () => {
        checkNetworkStatus()
      }
      window.ethereum.on('chainChanged', handleChainChanged)
      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    // 인증되지 않았으면 인증 화면 표시
    if (!isAuthenticated) {
      setIsOpen(true)
      setView('auth')
      return
    }

    // 인증 완료 시 모달 닫기
    // 지갑 연결은 선택사항이므로 자동으로 모달을 띄우지 않음
    if (isAuthenticated) {
      setIsOpen(false)
    }
  }, [isAuthenticated, isConnected, isRegistered, userWalletAddress])

  // 커스텀 이벤트로 모달 열기
  useEffect(() => {
    const handleOpenModal = () => {
      if (!isAuthenticated) {
        setIsOpen(true)
        setView('auth')
      }
    }

    window.addEventListener('openWalletModal', handleOpenModal)
    return () => {
      window.removeEventListener('openWalletModal', handleOpenModal)
    }
  }, [isAuthenticated])

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      alert('이메일과 비밀번호를 입력해주세요.')
      return
    }

    // 회원가입 시 닉네임도 필요
    if (isSignUp && !signUpUserName.trim()) {
      alert('닉네임을 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const success = isSignUp
        ? await signUp(email.trim(), password, signUpUserName.trim())
        : await signIn(email.trim(), password)

      if (success) {
        setEmail('')
        setPassword('')
        setSignUpUserName('')
        setIsOpen(false) // 회원가입/로그인 완료 시 모달 닫기
      }
    } catch (error) {
      console.error('인증 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const provider = getBrowserProvider()
      if (!provider) {
        alert('MetaMask가 설치되어 있지 않습니다.')
        return
      }

      // 네트워크 확인 및 전환
      const isCorrectNetwork = await checkNetwork(provider)
      if (!isCorrectNetwork) {
        const switched = await switchNetwork(provider)
        if (!switched) {
          alert(
            'Sepolia 테스트넷으로 전환해주세요. MetaMask에서 네트워크 전환을 승인해주세요.'
          )
          setIsLoading(false)
          return
        }
      }

      await connectWallet()
    } catch (error: any) {
      console.error('지갑 연결 실패:', error)
      if (error.code === 4001) {
        alert('지갑 연결이 거부되었습니다.')
      } else {
        alert('지갑 연결에 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchNetwork = async () => {
    setIsLoading(true)
    try {
      const provider = getBrowserProvider()
      if (!provider) {
        alert('MetaMask가 설치되어 있지 않습니다.')
        return
      }

      const switched = await switchNetwork(provider)
      if (!switched) {
        alert(
          '네트워크 전환에 실패했습니다. MetaMask에서 네트워크 전환을 승인해주세요.'
        )
      }
    } catch (error) {
      console.error('네트워크 전환 실패:', error)
      alert('네트워크 전환에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNameSubmit = async () => {
    if (!nameValue.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const success = await registerUser(nameValue.trim())
      if (success) {
        setIsOpen(false)
        setNameValue('')
      }
    } catch (error) {
      console.error('사용자 등록 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        {view === 'auth' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isSignUp ? (
                  <>
                    <UserPlus className="h-5 w-5" />
                    회원가입
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    로그인
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isSignUp
                  ? '서비스를 이용하려면 먼저 회원가입해주세요.'
                  : '서비스를 이용하려면 로그인해주세요.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAuth()
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAuth()
                    }
                  }}
                />
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="signUpUserName">닉네임</Label>
                  <Input
                    id="signUpUserName"
                    type="text"
                    placeholder="닉네임을 입력하세요"
                    value={signUpUserName}
                    onChange={(e) => setSignUpUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAuth()
                      }
                    }}
                  />
                </div>
              )}
              <Button
                onClick={handleAuth}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setEmail('')
                    setPassword('')
                    setSignUpUserName('')
                  }}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  {isSignUp
                    ? '이미 계정이 있으신가요? 로그인'
                    : '계정이 없으신가요? 회원가입'}
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'wallet' && (
          <>
            <DialogHeader>
              <DialogTitle>지갑 연결</DialogTitle>
              <DialogDescription>
                서비스를 이용하려면 MetaMask 지갑을 연결해주세요.
                <br />
                Sepolia 테스트넷에서 사용 가능합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 네트워크 상태 표시 */}
              {currentNetwork && (
                <div
                  className={`rounded-lg border p-4 ${
                    isWrongNetwork
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      className={`h-5 w-5 ${
                        isWrongNetwork ? 'text-yellow-600' : 'text-green-600'
                      }`}
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isWrongNetwork
                            ? 'text-yellow-800 dark:text-yellow-200'
                            : 'text-green-800 dark:text-green-200'
                        }`}
                      >
                        현재 네트워크: {currentNetwork}
                      </p>
                      {isWrongNetwork && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          Sepolia 테스트넷으로 전환해주세요.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 네트워크 전환 버튼 (잘못된 네트워크일 때만 표시) */}
              {isWrongNetwork && (
                <Button
                  onClick={handleSwitchNetwork}
                  variant="outline"
                  className="w-full gap-2"
                  disabled={isLoading}
                >
                  <AlertCircle className="h-4 w-4" />
                  Sepolia 테스트넷으로 전환
                </Button>
              )}

              {/* 지갑 연결 버튼 */}
              <Button
                onClick={handleConnect}
                size="lg"
                className="w-full gap-2"
                disabled={isLoading || isWrongNetwork}
              >
                <Wallet className="h-5 w-5" />
                {isLoading ? '연결 중...' : 'MetaMask 지갑 연결'}
              </Button>

              {isWrongNetwork && (
                <p className="text-xs text-center text-muted-foreground">
                  네트워크를 Sepolia로 전환한 후 지갑을 연결할 수 있습니다.
                </p>
              )}
            </div>
          </>
        )}

        {view === 'name' && (
          <>
            <DialogHeader>
              <DialogTitle>이름 등록</DialogTitle>
              <DialogDescription>
                서비스에서 사용할 이름을 입력해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">이름</Label>
                <Input
                  id="username"
                  placeholder="사용자 이름을 입력하세요"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNameSubmit()
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleNameSubmit}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '등록 중...' : '등록하기'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
