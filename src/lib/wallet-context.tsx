'use client'

import type React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import {
  getBrowserProvider,
  checkNetwork,
  switchNetwork,
} from './web3/provider'
import {
  isUserRegistered,
  registerUser as registerUserContract,
  getTokenBalance,
} from './web3/contract-functions'
import * as storage from './storage'

interface WalletContextType {
  isAuthenticated: boolean
  currentUserEmail: string | null
  isConnected: boolean
  address: string | null
  userName: string | null
  avatarUrl: string | null
  tokenBalance: number
  level: number
  isRegistered: boolean
  signUp: (
    email: string,
    password: string,
    userName: string
  ) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => void
  deleteAccount: () => Promise<boolean>
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  switchAccount: () => Promise<void>
  registerUser: (userName: string) => Promise<boolean>
  updateUserName: (userName: string) => Promise<boolean>
  updateAvatar: (avatarUrl: string | null) => Promise<boolean>
  refreshTokenBalance: () => Promise<void>
  refreshUserInfo: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

let isConnecting = false

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [userName, setUserNameState] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [level, setLevel] = useState(1)
  const [isRegistered, setIsRegistered] = useState(false)

  // 인증 상태 확인 및 사용자 정보 로드
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user) {
            setIsAuthenticated(true)
            setCurrentUserEmail(data.user.email)

            // 사용자 정보 조회 (email 기준)
            const userResponse = await fetch('/api/auth/user')
            if (userResponse.ok) {
              const userData = await userResponse.json()
              if (userData.user) {
                setUserNameState(userData.user.userName || null)
                setAvatarUrl(userData.user.avatarUrl || null)
                setLevel(userData.user.level || 1)
                // DB에서 토큰 잔액 조회
                setTokenBalance(userData.user.tokenBalance || 0)

                // 지갑 주소가 있으면 자동으로 연결 상태로 설정
                // 단, 회원가입 직후가 아닌 경우에만 (회원가입 시 walletAddress는 null)
                if (userData.user.walletAddress) {
                  setIsConnected(true)
                  setAddress(userData.user.walletAddress)
                  localStorage.setItem(
                    'walletAddress',
                    userData.user.walletAddress
                  )
                  await refreshUserInfo()
                } else {
                  // 지갑 주소가 없으면 연결 상태 초기화
                  setIsConnected(false)
                  setAddress(null)
                  localStorage.removeItem('walletAddress')
                  // 토큰 잔액도 0으로 설정
                  setTokenBalance(0)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('세션 확인 실패:', error)
      }
    }
    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 지갑 연결 상태 확인 및 사용자 정보 로드
  // 주의: 회원가입/로그인 시 localStorage의 walletAddress는 삭제되므로
  // 여기서는 자동으로 연결하지 않습니다. 사용자가 명시적으로 지갑을 연결해야 합니다.
  useEffect(() => {
    // 이전 로직 제거 - 회원가입/로그인 후에는 항상 지갑 연결 단계를 거쳐야 함
    // 자동 연결을 원하지 않으므로 이 useEffect는 비활성화
  }, [isAuthenticated])

  // 지갑 주소 변경 감지
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet()
      } else if (accounts[0] !== address) {
        setAddress(accounts[0])
        localStorage.setItem('walletAddress', accounts[0])
        await refreshUserInfo()
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [address])

  // 사용자 정보 새로고침
  const refreshUserInfo = async () => {
    if (!address) return

    try {
      // 주소를 소문자로 변환하여 일관성 유지
      const normalizedAddress = address.toLowerCase()

      // 사용자 등록 여부 확인
      const registered = await isUserRegistered(normalizedAddress)
      setIsRegistered(registered)

      console.log('사용자 정보 새로고침:', {
        address: normalizedAddress,
        registered,
      })

      if (registered) {
        // 사용자 정보 조회 (MongoDB)
        const userInfo = await storage.getUserInfo(normalizedAddress)
        if (userInfo) {
          setUserNameState(userInfo.userName)
        } else {
          const savedUserName = localStorage.getItem(`userName_${address}`)
          if (savedUserName) {
            setUserNameState(savedUserName)
          }
        }
      }

      // 토큰 잔액 조회
      await refreshTokenBalance()
    } catch (error) {
      console.error('사용자 정보 새로고침 실패:', error)
    }
  }

  // 토큰 잔액 새로고침 (DB에서만 조회, 블록체인 동기화 안 함)
  let refreshTimeout: NodeJS.Timeout | null = null
  const refreshTokenBalance = async () => {
    if (!isAuthenticated) {
      console.log('[토큰 잔액] 인증되지 않았습니다.')
      setTokenBalance(0)
      return
    }

    // 이전 요청 취소
    if (refreshTimeout) {
      clearTimeout(refreshTimeout)
    }

    // 500ms debounce로 중복 요청 방지
    refreshTimeout = setTimeout(async () => {
      console.log('[토큰 잔액] 새로고침 시작 (DB에서만 조회)')

      try {
        // DB에서만 토큰 잔액 조회 (블록체인 동기화 안 함)
        const userResponse = await fetch('/api/auth/user')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          if (userData.user) {
            const dbBalance = userData.user.tokenBalance || 0
            const userLevel = userData.user.level || 1
            console.log('[토큰 잔액] DB 잔액 (WAK):', dbBalance)
            console.log('[레벨] 현재 레벨:', userLevel)
            setTokenBalance(dbBalance)
            setLevel(userLevel)
          } else {
            setTokenBalance(0)
            setLevel(1)
          }
        } else {
          setTokenBalance(0)
          setLevel(1)
        }
      } catch (error: any) {
        console.error('[토큰 잔액] 조회 실패:', error)
        setTokenBalance(0)
        setLevel(1)
      }
    }, 500)
  }

  const connectWallet = async () => {
    if (!isAuthenticated) {
      alert('먼저 로그인해주세요.')
      return
    }

    if (isConnecting) {
      console.log('[v0] Wallet connection already in progress')
      return
    }

    const provider = getBrowserProvider()
    if (!provider) {
      alert('MetaMask가 설치되어 있지 않습니다. MetaMask를 설치해주세요.')
      return
    }

    isConnecting = true

    try {
      // 네트워크 확인 및 전환 (Sepolia 테스트넷)
      const isCorrectNetwork = await checkNetwork(provider)
      if (!isCorrectNetwork) {
        const switched = await switchNetwork(provider)
        if (!switched) {
          alert(
            'Sepolia 테스트넷으로 전환해주세요. MetaMask에서 네트워크 전환을 승인해주세요.'
          )
          return
        }
      }

      // 계정 요청
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
      const account = accounts[0]
      setIsConnected(true)
      setAddress(account)
      localStorage.setItem('walletAddress', account)

      // 유저 테이블에 지갑 주소 저장
      try {
        await fetch('/api/auth/user-wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ walletAddress: account }),
        })
      } catch (error) {
        console.error('지갑 주소 저장 실패:', error)
      }

      // 사용자 정보 로드
      await refreshUserInfo()
    } catch (error: any) {
      console.error('지갑 연결 실패:', error)

      if (error.code === -32002) {
        alert(
          'MetaMask에서 이미 연결 요청이 대기 중입니다. MetaMask 팝업을 확인해주세요.'
        )
      } else if (error.code === 4001) {
        alert('지갑 연결이 거부되었습니다.')
      } else {
        alert('지갑 연결에 실패했습니다.')
      }
    } finally {
      isConnecting = false
    }
  }

  const signUp = async (
    email: string,
    password: string,
    userName: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, userName }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '회원가입에 실패했습니다.')
        return false
      }

      const data = await response.json()

      // 회원가입 시 이전 지갑 연결 정보 완전 초기화
      setIsConnected(false)
      setAddress(null)
      setIsRegistered(false)
      setTokenBalance(0)
      // 모든 지갑 관련 localStorage 항목 삭제
      localStorage.removeItem('walletAddress')
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('userName_')) {
            localStorage.removeItem(key)
          }
        })
      }

      setIsAuthenticated(true)
      setCurrentUserEmail(data.email)

      // 사용자 정보 조회하여 userName 설정
      // 회원가입 직후에는 walletAddress가 null이므로 자동 연결되지 않음
      const userResponse = await fetch('/api/auth/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.user) {
          setUserNameState(userData.user.userName || null)
          setLevel(userData.user.level || 1)
          // 회원가입 직후에는 지갑 주소가 없으므로 연결하지 않음
        }
      }

      return true
    } catch (error) {
      console.error('회원가입 실패:', error)
      alert('회원가입에 실패했습니다.')
      return false
    }
  }

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '로그인에 실패했습니다.')
        return false
      }

      const data = await response.json()

      // 로그인 시 이전 지갑 연결 정보 초기화 (새로운 세션이므로)
      setIsConnected(false)
      setAddress(null)
      setIsRegistered(false)
      setTokenBalance(0)
      // 모든 지갑 관련 localStorage 항목 삭제
      localStorage.removeItem('walletAddress')
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('userName_')) {
            localStorage.removeItem(key)
          }
        })
      }

      setIsAuthenticated(true)
      setCurrentUserEmail(data.email)

      // 사용자 정보 조회하여 userName 설정
      const userResponse = await fetch('/api/auth/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.user) {
          setUserNameState(userData.user.userName || null)
          setAvatarUrl(userData.user.avatarUrl || null)
          setLevel(userData.user.level || 1)

          // 지갑 주소가 있으면 자동으로 연결 상태로 설정
          // (로그인 시에는 기존에 연결된 지갑이 있으면 자동 연결)
          if (userData.user.walletAddress) {
            setIsConnected(true)
            setAddress(userData.user.walletAddress)
            localStorage.setItem('walletAddress', userData.user.walletAddress)
            await refreshUserInfo()
          } else {
            // 지갑 주소가 없으면 연결 상태 유지 (연결 안 함)
            setIsConnected(false)
            setAddress(null)
          }
        }
      }

      return true
    } catch (error) {
      console.error('로그인 실패:', error)
      alert('로그인에 실패했습니다.')
      return false
    }
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('로그아웃 실패:', error)
    } finally {
      setIsAuthenticated(false)
      setCurrentUserEmail(null)
      disconnectWallet()
    }
  }

  const deleteAccount = async (): Promise<boolean> => {
    try {
      // 먼저 사용자 정보 조회하여 지갑 주소와 토큰 잔액 확인
      const userResponse = await fetch('/api/auth/user')
      let walletAddress: string | null = null
      let tokenBalance: number = 0

      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.user) {
          walletAddress = userData.user.walletAddress
          tokenBalance = userData.user.tokenBalance || 0
        }
      }

      // 토큰이 있으면 컨트랙트로 반환
      if (walletAddress && tokenBalance > 0) {
        try {
          const { transferTokens } = await import('./web3/contract-functions')
          const { CONTRACT_ADDRESSES } = await import('./web3/config')

          if (!CONTRACT_ADDRESSES.TOKEN_CONTRACT) {
            throw new Error('토큰 컨트랙트 주소가 설정되지 않았습니다.')
          }

          // 전체 토큰을 컨트랙트로 전송 (가스비는 별도로 필요)
          const tokenAmountInWei = BigInt(Math.floor(tokenBalance * 1e18))

          console.log('[회원탈퇴] 토큰 반환 시작:', {
            from: walletAddress,
            to: CONTRACT_ADDRESSES.TOKEN_CONTRACT,
            amount: tokenBalance,
            amountWei: tokenAmountInWei.toString(),
          })

          // 컨트랙트 주소로 토큰 전송
          await transferTokens(
            walletAddress,
            CONTRACT_ADDRESSES.TOKEN_CONTRACT,
            tokenAmountInWei
          )

          console.log('[회원탈퇴] ✅ 토큰 반환 완료:', tokenBalance, 'WAK')
          alert(`${tokenBalance} WAK 토큰이 컨트랙트로 반환되었습니다.`)
        } catch (tokenError: any) {
          console.error('[회원탈퇴] 토큰 반환 실패:', tokenError)
          // 토큰 반환 실패해도 회원탈퇴는 진행
          const errorMsg = tokenError.message || '알 수 없는 오류'
          if (errorMsg.includes('거부') || errorMsg.includes('rejected')) {
            const proceed = window.confirm(
              '토큰 반환이 거부되었습니다. 토큰은 지갑에 남아있습니다. 회원탈퇴를 계속 진행하시겠습니까?'
            )
            if (!proceed) {
              return false
            }
          } else if (
            errorMsg.includes('잔액') ||
            errorMsg.includes('balance')
          ) {
            const proceed = window.confirm(
              '토큰 반환에 실패했습니다 (잔액 부족 또는 가스비 부족). 회원탈퇴를 계속 진행하시겠습니까?'
            )
            if (!proceed) {
              return false
            }
          } else {
            const proceed = window.confirm(
              `토큰 반환에 실패했습니다: ${errorMsg}. 회원탈퇴를 계속 진행하시겠습니까?`
            )
            if (!proceed) {
              return false
            }
          }
        }
      }

      // 회원탈퇴 API 호출
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '회원탈퇴에 실패했습니다.')
        return false
      }

      // 회원탈퇴 성공 시 모든 상태 초기화
      setIsAuthenticated(false)
      setCurrentUserEmail(null)
      setIsConnected(false)
      setAddress(null)
      setUserNameState(null)
      setTokenBalance(0)
      setIsRegistered(false)

      // 모든 localStorage 항목 삭제
      if (typeof window !== 'undefined') {
        localStorage.removeItem('walletAddress')
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('userName_')) {
            localStorage.removeItem(key)
          }
        })
      }

      return true
    } catch (error) {
      console.error('회원탈퇴 실패:', error)
      alert('회원탈퇴에 실패했습니다.')
      return false
    }
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAddress(null)
    setUserNameState(null)
    setTokenBalance(0)
    setIsRegistered(false)
    // 모든 지갑 관련 localStorage 항목 삭제
    localStorage.removeItem('walletAddress')
    // 모든 userName_* 항목 삭제
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('userName_')) {
          localStorage.removeItem(key)
        }
      })
    }
  }

  // 계정 전환 (MetaMask에서 계정 선택 팝업 표시)
  const switchAccount = async () => {
    if (!isAuthenticated) {
      alert('먼저 로그인해주세요.')
      return
    }

    const provider = getBrowserProvider()
    if (!provider) {
      alert('MetaMask가 설치되어 있지 않습니다.')
      return
    }

    try {
      // MetaMask에서 계정 선택 팝업 표시
      const accounts = await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })

      // 선택된 계정 가져오기
      const selectedAccounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (selectedAccounts && selectedAccounts.length > 0) {
        const newAccount = selectedAccounts[0]
        
        // 계정이 변경된 경우에만 업데이트
        if (newAccount !== address) {
          setAddress(newAccount)
          localStorage.setItem('walletAddress', newAccount)
          
          // 유저 테이블에 새 지갑 주소 저장
          try {
            await fetch('/api/auth/user-wallet', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ walletAddress: newAccount }),
            })
          } catch (error) {
            console.error('지갑 주소 저장 실패:', error)
          }

          // 사용자 정보 새로고침
          await refreshUserInfo()
        }
      }
    } catch (error: any) {
      console.error('계정 전환 실패:', error)
      if (error.code === 4001) {
        alert('계정 전환이 거부되었습니다.')
      } else {
        // wallet_requestPermissions가 지원되지 않는 경우 eth_requestAccounts 사용
        try {
          const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
          })
          if (accounts && accounts.length > 0) {
            const newAccount = accounts[0]
            if (newAccount !== address) {
              setAddress(newAccount)
              localStorage.setItem('walletAddress', newAccount)
              
              try {
                await fetch('/api/auth/user-wallet', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ walletAddress: newAccount }),
                })
              } catch (error) {
                console.error('지갑 주소 저장 실패:', error)
              }

              await refreshUserInfo()
            }
          }
        } catch (fallbackError: any) {
          console.error('계정 전환 실패:', fallbackError)
          alert('계정 전환에 실패했습니다. MetaMask에서 직접 계정을 전환해주세요.')
        }
      }
    }
  }

  const registerUser = async (userName: string): Promise<boolean> => {
    if (!address) {
      alert('지갑을 먼저 연결해주세요.')
      return false
    }

    try {
      const normalizedAddress = address.toLowerCase()
      console.log('[계정 등록] 시작:', { address: normalizedAddress, userName })
      
      const success = await registerUserContract(userName, normalizedAddress)

      if (success) {
        // 상태 업데이트
        setUserNameState(userName)
        setIsRegistered(true)
        localStorage.setItem(`userName_${address}`, userName)

        // 사용자 정보 새로고침으로 상태 동기화
        await refreshUserInfo()

        console.log('[계정 등록] 완료:', {
          address: normalizedAddress,
          userName,
          isRegistered: true,
        })
        alert(`${userName} 계정이 성공적으로 등록되었습니다!`)
        return true
      }
      
      console.error('[계정 등록] 실패: registerUserContract가 false 반환')
      alert('사용자 등록에 실패했습니다. 다시 시도해주세요.')
      return false
    } catch (error: any) {
      console.error('[계정 등록] 실패:', error)
      const errorMessage = error.message || '사용자 등록에 실패했습니다.'
      alert(errorMessage)
      return false
    }
  }

  // 사용자 이름 업데이트 (email 기준)
  const updateUserName = async (userName: string): Promise<boolean> => {
    if (!isAuthenticated) {
      alert('먼저 로그인해주세요.')
      return false
    }

    try {
      const response = await fetch('/api/auth/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '이름 변경에 실패했습니다.')
        return false
      }

      // 상태 업데이트
      setUserNameState(userName)

      console.log('사용자 이름 업데이트 완료:', {
        userName,
      })
      return true
    } catch (error: any) {
      console.error('사용자 이름 업데이트 실패:', error)
      alert('이름 변경에 실패했습니다.')
      return false
    }
  }

  // 프로필 사진 업데이트
  const updateAvatar = async (avatarUrl: string | null): Promise<boolean> => {
    if (!isAuthenticated) {
      alert('먼저 로그인해주세요.')
      return false
    }

    try {
      const response = await fetch('/api/auth/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatarUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '프로필 사진 변경에 실패했습니다.')
        return false
      }

      // 상태 업데이트
      setAvatarUrl(avatarUrl)

      console.log('프로필 사진 업데이트 완료:', {
        avatarUrl,
      })
      return true
    } catch (error: any) {
      console.error('프로필 사진 업데이트 실패:', error)
      alert('프로필 사진 변경에 실패했습니다.')
      return false
    }
  }

  return (
    <WalletContext.Provider
      value={{
        isAuthenticated,
        currentUserEmail,
        isConnected,
        address,
        userName,
        avatarUrl,
        tokenBalance,
        level,
        isRegistered,
        signUp,
        signIn,
        signOut,
        deleteAccount,
        connectWallet,
        disconnectWallet,
        switchAccount,
        registerUser,
        updateUserName,
        updateAvatar,
        refreshTokenBalance,
        refreshUserInfo,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

declare global {
  interface Window {
    ethereum?: any
  }
}
