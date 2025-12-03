'use client'

import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProtectedPage } from '@/components/protected-page'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Coins,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Award,
  Calendar,
  Eye,
  Edit,
  Heart,
  X,
  ArrowDownToLine,
  Loader2,
  Upload,
  Image as ImageIcon,
  Mail,
} from 'lucide-react'
import Link from 'next/link'
import { useWallet } from '@/lib/wallet-context'
import { useState, useEffect } from 'react'
import * as storage from '@/lib/storage'
import {
  transferTokens,
  buyTokensWithEth,
  getExchangeRate,
} from '@/lib/web3/contract-functions'
import { getBrowserProvider } from '@/lib/web3/provider'
import type { Question, Answer } from '@/lib/contracts/types'

export default function MyPage() {
  const {
    userName,
    avatarUrl,
    currentUserEmail,
    level,
    updateUserName,
    updateAvatar,
    tokenBalance,
    address,
    refreshTokenBalance,
    deleteAccount,
  } = useWallet()
  const [isEditNameOpen, setIsEditNameOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false)
  const [avatarInputMethod, setAvatarInputMethod] = useState<'upload' | 'url'>('upload')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false)
  const [interestTags, setInterestTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeAmount, setExchangeAmount] = useState('')
  const [exchangeError, setExchangeError] = useState('')
  const [isExchanging, setIsExchanging] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number>(1) // 1 ETH = 1 WAK
  const [ethBalance, setEthBalance] = useState<number>(0)
  const [contractBalance, setContractBalance] = useState<number>(0)
  const [isCheckingContractBalance, setIsCheckingContractBalance] =
    useState(false)
  const [myQuestions, setMyQuestions] = useState<
    Array<Question & { content: string }>
  >([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [myAnswers, setMyAnswers] = useState<
    Array<Answer & { content: string; questionTitle?: string }>
  >([])
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<
    Array<Question & { content: string }>
  >([])
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false)
  const [rewards, setRewards] = useState<
    Array<{ type: string; amount: number; date: string; tx?: string }>
  >([])
  const [transactions, setTransactions] = useState<
    Array<{
      type: string
      ethAmount: number
      wakAmount: number
      transactionHash?: string
      status: string
      date: string
      time: string
      createdAt: number
    }>
  >([])
  const [activities, setActivities] = useState<
    Array<{ type: string; content: string; time: string }>
  >([])

  const availableTags = [
    'React',
    'TypeScript',
    'Next.js',
    'Blockchain',
    'Python',
    'Django',
    'JavaScript',
    'Node.js',
    'Web3',
    'Smart Contract',
    'Solidity',
    'Vue.js',
    'Angular',
    'Java',
    'Spring',
    'Rust',
    'Go',
    'C++',
    'Security',
  ]

  // 모달이 열릴 때 현재 이름으로 초기화
  useEffect(() => {
    if (isEditNameOpen && userName) {
      setNewName(userName)
    }
  }, [isEditNameOpen, userName])

  useEffect(() => {
    const savedTags = localStorage.getItem('interestTags')
    if (savedTags) {
      setInterestTags(JSON.parse(savedTags))
    } else {
      setInterestTags(['React', 'TypeScript', 'Next.js', 'Blockchain'])
    }
  }, [])

  useEffect(() => {
    if (interestTags.length > 0) {
      localStorage.setItem('interestTags', JSON.stringify(interestTags))
    }
  }, [interestTags])

  // 유저의 질문 로드
  useEffect(() => {
    const loadUserQuestions = async () => {
      if (!address) {
        setMyQuestions([])
        return
      }

      setIsLoadingQuestions(true)
      try {
        const questions = await storage.getUserQuestions(address)
        setMyQuestions(questions)
      } catch (error) {
        console.error('질문 로드 실패:', error)
        setMyQuestions([])
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadUserQuestions()
  }, [address])

  // 토큰 잔액 새로고침
  useEffect(() => {
    if (!address) return

    let cancelled = false

    const loadBalance = async () => {
      if (cancelled) return

      try {
        await refreshTokenBalance()
      } catch (error: any) {
        if (cancelled) return

        // "signal already cancelled" 에러는 무시
        const errorMessage = error?.message || ''
        const errorCode = error?.code || ''

        if (
          errorCode === 'UNSUPPORTED_OPERATION' ||
          errorMessage.includes('cancelled') ||
          errorMessage.includes('signal') ||
          errorMessage.includes('fetchCancelSignal')
        ) {
          return
        }
        console.error('토큰 잔액 조회 실패:', error)
      }
    }

    loadBalance()

    return () => {
      cancelled = true
    }
  }, [address, refreshTokenBalance])

  // ETH 잔액 및 환전 비율 조회
  useEffect(() => {
    const loadEthBalanceAndRate = async () => {
      if (!address) {
        setEthBalance(0)
        return
      }

      try {
        const provider = getBrowserProvider()
        if (provider) {
          const balance = await provider.getBalance(address)
          setEthBalance(Number(balance) / 1e18)
        }

        const rate = await getExchangeRate()
        // rate는 18자리 기준이므로 1e18로 나눠서 실제 비율 계산
        // 예: rate = 100 * 10^18이면 1 ETH = 100 WAK
        const rateInEth = Number(rate) / 1e18
        setExchangeRate(rateInEth)
      } catch (error) {
        console.error('ETH 잔액 조회 실패:', error)
      }
    }

    loadEthBalanceAndRate()
  }, [address])

  // 유저의 답변 로드
  useEffect(() => {
    const loadUserAnswers = async () => {
      if (!address) {
        setMyAnswers([])
        return
      }

      setIsLoadingAnswers(true)
      try {
        const answers = await storage.getUserAnswers(address)
        setMyAnswers(answers)
      } catch (error) {
        console.error('답변 로드 실패:', error)
        setMyAnswers([])
      } finally {
        setIsLoadingAnswers(false)
      }
    }

    loadUserAnswers()
  }, [address])

  // 유저의 찜 목록 로드
  useEffect(() => {
    const loadUserBookmarks = async () => {
      if (!address) {
        setBookmarkedQuestions([])
        return
      }

      setIsLoadingBookmarks(true)
      try {
        console.log('[마이페이지] 찜 목록 로드 시작:', address)
        const bookmarks = await storage.getUserBookmarksList(address)
        console.log('[마이페이지] 찜 목록 로드 완료:', bookmarks.length, '개')
        setBookmarkedQuestions(bookmarks)
      } catch (error) {
        console.error('[마이페이지] 찜 목록 로드 실패:', error)
        setBookmarkedQuestions([])
      } finally {
        setIsLoadingBookmarks(false)
      }
    }

    loadUserBookmarks()
  }, [address])

  // 보상 내역 로드
  useEffect(() => {
    const loadRewards = async () => {
      if (!address) {
        setRewards([])
        return
      }

      try {
        const rewardData = await storage.getUserRewards(address)
        setRewards(rewardData)
      } catch (error) {
        console.error('보상 내역 로드 실패:', error)
        setRewards([])
      }
    }

    loadRewards()
  }, [address])

  // 거래 내역 로드 (환전/출금)
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const transactionData = await storage.getUserTransactions()
        setTransactions(transactionData)
      } catch (error) {
        console.error('거래 내역 로드 실패:', error)
        setTransactions([])
      }
    }

    loadTransactions()
  }, [])

  // 활동 기록 로드
  useEffect(() => {
    const loadActivities = async () => {
      if (!address) {
        setActivities([])
        return
      }

      try {
        const activityData = await storage.getUserActivities(address)
        setActivities(activityData)
      } catch (error) {
        console.error('활동 기록 로드 실패:', error)
        setActivities([])
      }
    }

    loadActivities()
  }, [address])

  const handleNameChange = async () => {
    if (!newName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsUpdating(true)
    try {
      const success = await updateUserName(newName.trim())
      if (success) {
        setIsEditNameOpen(false)
        setNewName('')
        alert('이름이 변경되었습니다.')
      }
    } catch (error) {
      console.error('이름 변경 실패:', error)
      alert('이름 변경에 실패했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarChange = async () => {
    setIsUpdatingAvatar(true)
    try {
      let finalAvatarUrl: string | null = null

      if (avatarInputMethod === 'upload') {
        if (!avatarFile) {
          alert('이미지를 선택해주세요.')
          setIsUpdatingAvatar(false)
          return
        }
        // Base64로 변환하여 저장 (또는 서버에 업로드)
        finalAvatarUrl = avatarPreview
      } else {
        // URL 입력 방식
        if (!avatarUrlInput.trim()) {
          // URL이 비어있으면 프로필 사진 제거
          finalAvatarUrl = null
        } else {
          // URL 유효성 검사
          try {
            new URL(avatarUrlInput.trim())
            finalAvatarUrl = avatarUrlInput.trim()
          } catch {
            alert('올바른 URL을 입력해주세요.')
            setIsUpdatingAvatar(false)
            return
          }
        }
      }

      const success = await updateAvatar(finalAvatarUrl)
      if (success) {
        setIsEditAvatarOpen(false)
        setAvatarFile(null)
        setAvatarPreview(null)
        setAvatarUrlInput('')
        setAvatarInputMethod('upload')
        alert('프로필 사진이 변경되었습니다.')
      }
    } catch (error) {
      console.error('프로필 사진 변경 실패:', error)
      alert('프로필 사진 변경에 실패했습니다.')
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      '정말 회원탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.'
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    try {
      const success = await deleteAccount()
      if (success) {
        alert('회원탈퇴가 완료되었습니다.')
        // 홈페이지로 리다이렉트
        window.location.href = '/'
      }
    } catch (error) {
      console.error('회원탈퇴 실패:', error)
      alert('회원탈퇴에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!address) {
      alert('지갑이 연결되지 않았습니다.')
      return
    }

    setWithdrawError('')
    const amount = Number.parseFloat(withdrawAmount)

    if (!amount || amount <= 0) {
      setWithdrawError('출금 금액을 입력해주세요')
      return
    }

    if (amount > tokenBalance) {
      setWithdrawError('잔액이 부족합니다')
      return
    }

    setIsWithdrawing(true)
    try {
      // WAK를 wei로 변환 (18 decimals)
      const amountInWei = BigInt(Math.floor(amount * 1e18))

      // 현재 지갑 주소에서 자신의 주소로 전송 (실제로는 다른 주소로 전송할 수 있도록 수정 필요)
      // 여기서는 예시로 자신의 주소로 전송
      await transferTokens(address, address, amountInWei)

      alert(`${amount} WAK를 성공적으로 전송했습니다!`)
      setIsWithdrawOpen(false)
      setWithdrawAmount('')

      // 잔액 새로고침
      if (refreshTokenBalance) {
        await refreshTokenBalance()
      }

      // 거래 내역 새로고침
      try {
        const transactionData = await storage.getUserTransactions()
        setTransactions(transactionData)
      } catch (error) {
        console.error('거래 내역 로드 실패:', error)
      }
    } catch (error: any) {
      console.error('전송 실패:', error)
      setWithdrawError(
        error.message || '전송에 실패했습니다. 다시 시도해주세요.'
      )
    } finally {
      setIsWithdrawing(false)
    }
  }

  const handleExchange = async () => {
    if (!address) {
      alert('지갑이 연결되지 않았습니다.')
      return
    }

    setExchangeError('')
    const amount = Number.parseFloat(exchangeAmount)

    if (!amount || amount <= 0) {
      setExchangeError('환전할 ETH 금액을 입력해주세요')
      return
    }

    if (amount > ethBalance) {
      setExchangeError('ETH 잔액이 부족합니다')
      return
    }

    setIsExchanging(true)
    try {
      // ETH를 wei로 변환 (18 decimals)
      const amountInWei = BigInt(Math.floor(amount * 1e18))

      // ETH를 보내서 WAK 토큰 받기
      await buyTokensWithEth(amountInWei)

      // exchangeRate는 18자리 기준이므로 1e18로 나눠서 실제 비율 계산
      const rateInEth = Number(exchangeRate) / 1e18
      const wakAmount = amount * rateInEth
      alert(`${amount} ETH를 ${wakAmount.toFixed(2)} WAK로 환전했습니다!`)
      setIsExchangeOpen(false)
      setExchangeAmount('')

      // 잔액 새로고침
      if (refreshTokenBalance) {
        await refreshTokenBalance()
      }

      // ETH 잔액도 새로고침
      const provider = getBrowserProvider()
      if (provider) {
        const balance = await provider.getBalance(address)
        setEthBalance(Number(balance) / 1e18)
      }

      // 거래 내역 새로고침
      try {
        const transactionData = await storage.getUserTransactions()
        setTransactions(transactionData)
      } catch (error) {
        console.error('거래 내역 로드 실패:', error)
      }
    } catch (error: any) {
      console.error('환전 실패:', error)
      setExchangeError(
        error.message || '환전에 실패했습니다. 다시 시도해주세요.'
      )
    } finally {
      setIsExchanging(false)
    }
  }

  const handleAddTag = (tag: string) => {
    if (!interestTags.includes(tag)) {
      setInterestTags([...interestTags, tag])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setInterestTags(interestTags.filter((tag) => tag !== tagToRemove))
  }

  const handleAddCustomTag = () => {
    if (newTag.trim() && !interestTags.includes(newTag.trim())) {
      setInterestTags([...interestTags, newTag.trim()])
      setNewTag('')
    }
  }

  // 날짜 포맷팅 함수
  const formatDate = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp))
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8 lg:px-8">
          {/* 프로필 헤더 */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 cursor-pointer" onClick={() => setIsEditAvatarOpen(true)}>
                      <AvatarImage src={avatarUrl || '/developer-working.png'} />
                      <AvatarFallback className="text-2xl">
                        {userName?.[0] || 'test'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer" onClick={() => setIsEditAvatarOpen(true)}>
                      <Edit className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <h1 className="text-2xl font-bold">
                        {userName || 'test1'}
                      </h1>
                      <Badge variant="secondary">Level {level}</Badge>
                    </div>
                    {currentUserEmail && (
                      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{currentUserEmail}</span>
                      </div>
                    )}
                    <p className="mb-2 text-sm text-muted-foreground">
                      {address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : '지갑이 연결되지 않았습니다'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">React 전문가</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">Top 10%</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditNameOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    프로필 수정
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteAccountOpen(true)}
                  >
                    회원탈퇴
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            {/* 사이드바 - 통계 */}
            <aside className="space-y-6">
              {/* 토큰 잔액 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">토큰 잔액</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {tokenBalance.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">WAK</span>
                  </div>

                  {/* 컨트랙트 주소에 토큰이 있는 경우 알림 */}
                  {tokenBalance === 0 && contractBalance > 0 && (
                    <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                      <p className="font-semibold mb-1">
                        ⚠️ 토큰이 컨트랙트 주소에 있습니다
                      </p>
                      <p className="text-xs mb-2">
                        컨트랙트 주소 잔액: {contractBalance.toLocaleString()}{' '}
                        WAK
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Remix나 MetaMask를 사용하여 컨트랙트의 transfer 함수를
                        호출하여 지갑 주소로 전송해야 합니다.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => setIsExchangeOpen(true)}
                    >
                      <Coins className="mr-2 h-4 w-4" />
                      ETH → WAK 환전
                    </Button>
                    <Button
                      className="w-full"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsWithdrawOpen(true)}
                    >
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      토큰 출금
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 활동 통계 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">활동 통계</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">질문</span>
                    </div>
                    <span className="font-semibold">{myQuestions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">답변</span>
                    </div>
                    <span className="font-semibold">67</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">채택</span>
                    </div>
                    <span className="font-semibold">45</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">평판 점수</span>
                    </div>
                    <span className="font-semibold">892</span>
                  </div>
                </CardContent>
              </Card>

              {/* 레벨 진행도 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">다음 레벨까지</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">Level {level}</span>
                    <span className="text-muted-foreground">Level {level + 1}</span>
                  </div>
                  <Progress value={0} className="mb-2" />
                  <p className="text-xs text-muted-foreground">
                    답변 1개를 더 작성하면 레벨이 올라갑니다
                  </p>
                </CardContent>
              </Card>

              {/* 관심 태그 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">관심 태그</CardTitle>
                  <CardDescription>
                    알림을 받을 태그를 설정하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {interestTags.map((tag) => (
                      <Badge key={tag} className="pr-1">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 rounded-full hover:bg-background/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full bg-transparent"
                      onClick={() => setIsTagManagementOpen(true)}
                    >
                      태그 관리
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </aside>

            {/* 메인 콘텐츠 */}
            <div>
              <Tabs defaultValue="questions" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="questions">내 질문</TabsTrigger>
                  <TabsTrigger value="answers">내 답변</TabsTrigger>
                  <TabsTrigger value="bookmarks">찜 목록</TabsTrigger>
                  <TabsTrigger value="rewards">보상 내역</TabsTrigger>
                  <TabsTrigger value="activity">활동 기록</TabsTrigger>
                </TabsList>

                {/* 내 질문 탭 */}
                <TabsContent value="questions" className="space-y-4">
                  {isLoadingQuestions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : myQuestions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        등록한 질문이 없습니다.
                      </CardContent>
                    </Card>
                  ) : (
                    myQuestions.map((question) => (
                      <Card key={question.id.toString()}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <Link href={`/question/${question.id}`}>
                                <CardTitle className="mb-2 text-lg hover:text-primary cursor-pointer">
                                  {question.title}
                                </CardTitle>
                              </Link>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-4 w-4" />
                                  {Number(question.answerCount)}개 답변
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(question.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1">
                                <Coins className="h-4 w-4 text-primary" />
                                <span className="font-bold text-primary">
                                  {Number(question.reward) / 1e18} WAK
                                </span>
                              </div>
                              <Badge
                                variant={
                                  question.status === 'solved'
                                    ? 'default'
                                    : 'outline'
                                }
                              >
                                {question.status === 'solved'
                                  ? '해결됨'
                                  : '진행중'}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* 내 답변 탭 */}
                <TabsContent value="answers" className="space-y-4">
                  {isLoadingAnswers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : myAnswers.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        작성한 답변이 없습니다.
                      </CardContent>
                    </Card>
                  ) : (
                    myAnswers.map((answer, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <CardDescription className="mb-2">
                                답변한 질문
                              </CardDescription>
                              <Link href={`/question/${answer.questionId}`}>
                                <CardTitle className="mb-2 text-lg hover:text-primary cursor-pointer">
                                  {answer.questionTitle ||
                                    `질문 #${answer.questionId}`}
                                </CardTitle>
                              </Link>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(answer.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge
                                variant={
                                  answer.isAccepted ? 'default' : 'secondary'
                                }
                              >
                                {answer.isAccepted ? '채택됨 ✓' : '대기중'}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* 보상 내역 탭 */}
                <TabsContent value="rewards" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>총 획득 토큰</CardTitle>
                      <CardDescription>
                        전체 기간 동안 획득한 토큰
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 text-4xl font-bold text-primary">
                        {rewards
                          .reduce((sum, r) => sum + r.amount, 0)
                          .toLocaleString()}{' '}
                        WAK
                      </div>
                      <div className="space-y-3">
                        {rewards.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            보상 내역이 없습니다.
                          </p>
                        ) : (
                          rewards.map((reward, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-lg border border-border p-4"
                            >
                              <div>
                                <p className="font-medium">{reward.type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {reward.date}
                                  {reward.tx && ` • TX: ${reward.tx}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary">
                                  +{reward.amount} WAK
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 환전/출금 내역 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>환전/출금 내역</CardTitle>
                      <CardDescription>
                        ETH ↔ WAK 환전 및 출금 내역
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {transactions.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            거래 내역이 없습니다.
                          </p>
                        ) : (
                          transactions.map((tx, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-lg border border-border p-4"
                            >
                              <div>
                                <p className="font-medium">{tx.type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {tx.date} {tx.time}
                                  {tx.transactionHash && (
                                    <span className="ml-2">
                                      • TX: {tx.transactionHash.slice(0, 10)}...
                                    </span>
                                  )}
                                </p>
                                {tx.type === '환전' && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tx.ethAmount.toFixed(4)} ETH →{' '}
                                    {tx.wakAmount.toFixed(2)} WAK
                                  </p>
                                )}
                                {tx.type === '출금' && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tx.wakAmount.toFixed(2)} WAK 출금
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-bold ${
                                    tx.type === '환전'
                                      ? 'text-primary'
                                      : 'text-destructive'
                                  }`}
                                >
                                  {tx.type === '환전' ? '+' : '-'}
                                  {tx.wakAmount.toFixed(2)} WAK
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {tx.status}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 활동 기록 탭 */}
                <TabsContent value="activity" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>최근 활동</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activities.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            활동 기록이 없습니다.
                          </p>
                        ) : (
                          activities.map((activity, index) => (
                            <div key={index} className="flex gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{activity.type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.content}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {activity.time}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bookmarks" className="space-y-4">
                  {isLoadingBookmarks ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : bookmarkedQuestions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        찜한 질문이 없습니다.
                      </CardContent>
                    </Card>
                  ) : (
                    bookmarkedQuestions.map((question) => (
                      <Card key={question.id.toString()}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Heart className="h-4 w-4 fill-primary text-primary" />
                                <CardDescription>저도 궁금해요</CardDescription>
                              </div>
                              <Link href={`/question/${question.id}`}>
                                <CardTitle className="mb-2 text-lg hover:text-primary cursor-pointer">
                                  {question.title}
                                </CardTitle>
                              </Link>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-4 w-4" />
                                  {Number(question.answerCount)}개 답변
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(question.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1">
                                <Coins className="h-4 w-4 text-primary" />
                                <span className="font-bold text-primary">
                                  {Number(question.reward) / 1e18} WAK
                                </span>
                              </div>
                              <Badge
                                variant={
                                  question.status === 'solved' ||
                                  question.status === 'answered'
                                    ? 'default'
                                    : 'outline'
                                }
                              >
                                {question.status === 'solved' ||
                                question.status === 'answered'
                                  ? '답변됨'
                                  : '진행중'}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* 이름 변경 모달 */}
        <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>이름 변경</DialogTitle>
              <DialogDescription>
                새로운 닉네임을 입력해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">닉네임</Label>
                <Input
                  id="name"
                  placeholder="새 닉네임을 입력하세요"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNameChange()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditNameOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleNameChange}>변경</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 프로필 사진 변경 모달 */}
        <Dialog open={isEditAvatarOpen} onOpenChange={setIsEditAvatarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>프로필 사진 변경</DialogTitle>
              <DialogDescription>
                이미지를 업로드하거나 이미지 URL을 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* 방법 선택 */}
              <div className="grid gap-2">
                <Label>방법 선택</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={avatarInputMethod === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAvatarInputMethod('upload')
                      setAvatarUrlInput('')
                    }}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    이미지 업로드
                  </Button>
                  <Button
                    type="button"
                    variant={avatarInputMethod === 'url' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAvatarInputMethod('url')
                      setAvatarFile(null)
                      setAvatarPreview(null)
                    }}
                    className="flex-1"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    URL 입력
                  </Button>
                </div>
              </div>

              {/* 이미지 업로드 방식 */}
              {avatarInputMethod === 'upload' && (
                <div className="grid gap-2">
                  <Label>이미지 선택</Label>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={avatarPreview || avatarUrl || '/developer-working.png'} />
                        <AvatarFallback className="text-xl">
                          {userName?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          JPG, PNG, GIF (최대 5MB)
                        </p>
                      </div>
                    </div>
                    {avatarPreview && (
                      <div className="text-sm text-muted-foreground">
                        미리보기
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* URL 입력 방식 */}
              {avatarInputMethod === 'url' && (
                <div className="grid gap-2">
                  <Label htmlFor="avatarUrl">이미지 URL</Label>
                  <Input
                    id="avatarUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                  />
                  {avatarUrlInput && (
                    <div className="mt-2">
                      <Label>미리보기</Label>
                      <Avatar className="h-20 w-20 mt-2">
                        <AvatarImage src={avatarUrlInput} />
                        <AvatarFallback className="text-xl">
                          {userName?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAvatarUrlInput('')
                    }}
                    className="w-fit"
                  >
                    URL 초기화
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditAvatarOpen(false)
                  setAvatarFile(null)
                  setAvatarPreview(null)
                  setAvatarUrlInput('')
                  setAvatarInputMethod('upload')
                }}
              >
                취소
              </Button>
              <Button onClick={handleAvatarChange} disabled={isUpdatingAvatar}>
                {isUpdatingAvatar ? '변경 중...' : '변경'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isTagManagementOpen}
          onOpenChange={setIsTagManagementOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>관심 태그 관리</DialogTitle>
              <DialogDescription>
                관심있는 태그를 선택하면 관련 질문이 올라올 때 알림을 받을 수
                있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Current tags */}
              <div className="grid gap-2">
                <Label>현재 관심 태그 ({interestTags.length}개)</Label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md">
                  {interestTags.length > 0 ? (
                    interestTags.map((tag) => (
                      <Badge key={tag} className="pr-1">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 rounded-full hover:bg-background/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      선택된 태그가 없습니다
                    </span>
                  )}
                </div>
              </div>

              {/* Add custom tag */}
              <div className="grid gap-2">
                <Label htmlFor="custom-tag">커스텀 태그 추가</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-tag"
                    placeholder="태그 이름 입력"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCustomTag()
                      }
                    }}
                  />
                  <Button onClick={handleAddCustomTag} size="sm">
                    추가
                  </Button>
                </div>
              </div>

              {/* Available tags */}
              <div className="grid gap-2">
                <Label>추천 태그 선택</Label>
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-3 border rounded-md">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={
                        interestTags.includes(tag) ? 'default' : 'outline'
                      }
                      className="cursor-pointer hover:bg-primary/80"
                      onClick={() => {
                        if (interestTags.includes(tag)) {
                          handleRemoveTag(tag)
                        } else {
                          handleAddTag(tag)
                        }
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsTagManagementOpen(false)}>
                완료
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 환전 모달 */}
        <Dialog open={isExchangeOpen} onOpenChange={setIsExchangeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ETH → WAK 환전</DialogTitle>
              <DialogDescription>
                SepoliaETH를 WAK 토큰으로 환전합니다. 환전 비율: 0.01 ETH = 1
                WAK
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Current ETH Balance */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  현재 ETH 잔액
                </p>
                <p className="text-2xl font-bold">
                  {ethBalance.toFixed(4)} ETH
                </p>
              </div>

              {/* Exchange Amount */}
              <div className="grid gap-2">
                <Label htmlFor="exchange-amount">환전할 ETH 금액</Label>
                <div className="flex gap-2">
                  <Input
                    id="exchange-amount"
                    type="number"
                    step="0.001"
                    placeholder="환전할 ETH 금액을 입력하세요"
                    value={exchangeAmount}
                    onChange={(e) => {
                      setExchangeAmount(e.target.value)
                      setExchangeError('')
                    }}
                    disabled={isExchanging}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setExchangeAmount(ethBalance.toString())}
                    disabled={isExchanging}
                  >
                    전액
                  </Button>
                </div>
                {exchangeAmount && !isNaN(Number(exchangeAmount)) && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm text-muted-foreground mb-1">
                      받을 WAK 토큰
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {(Number(exchangeAmount) * exchangeRate).toFixed(2)} WAK
                    </p>
                  </div>
                )}
                {exchangeError && (
                  <p className="text-sm text-destructive">{exchangeError}</p>
                )}
              </div>

              {/* Exchange Rate Info */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  환전 비율 정보
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>환전 비율:</span>
                    <span className="font-medium">
                      0.01 ETH = 1 WAK (1 ETH = {exchangeRate} WAK)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>최소 환전 금액:</span>
                    <span className="font-medium">0.001 ETH</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsExchangeOpen(false)
                  setExchangeAmount('')
                  setExchangeError('')
                }}
                disabled={isExchanging}
              >
                취소
              </Button>
              <Button onClick={handleExchange} disabled={isExchanging}>
                {isExchanging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    환전 중...
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    환전하기
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 출금 모달 */}
        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>토큰 출금</DialogTitle>
              <DialogDescription>
                출금할 토큰을 메타마스크 지갑으로 전송합니다. 가스비가 발생할 수
                있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Current Balance */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-1">현재 잔액</p>
                <p className="text-2xl font-bold">
                  {tokenBalance.toLocaleString()} WAK
                </p>
              </div>

              {/* Withdraw Amount */}
              <div className="grid gap-2">
                <Label htmlFor="withdraw-amount">출금 금액</Label>
                <div className="flex gap-2">
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="출금할 금액을 입력하세요"
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value)
                      setWithdrawError('')
                    }}
                    disabled={isWithdrawing}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setWithdrawAmount(tokenBalance.toString())}
                    disabled={isWithdrawing}
                  >
                    전액
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  최소 출금 금액: 10 WAK
                </p>
                {withdrawError && (
                  <p className="text-sm text-destructive">{withdrawError}</p>
                )}
              </div>

              {/* Wallet Address */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  받는 지갑 주소
                </p>
                <p className="text-sm font-mono break-all">{address}</p>
              </div>

              {/* Estimated Gas Fee */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">예상 가스비</span>
                <span className="font-medium">~0.002 ETH</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsWithdrawOpen(false)
                  setWithdrawAmount('')
                  setWithdrawError('')
                }}
                disabled={isWithdrawing}
              >
                취소
              </Button>
              <Button onClick={handleWithdraw} disabled={isWithdrawing}>
                {isWithdrawing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    출금하기
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 회원탈퇴 모달 */}
        <Dialog
          open={isDeleteAccountOpen}
          onOpenChange={setIsDeleteAccountOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>회원탈퇴</DialogTitle>
              <DialogDescription>
                정말 회원탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수
                없습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive mb-2">
                  ⚠️ 주의사항
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>모든 계정 정보가 삭제됩니다</li>
                  <li>연결된 지갑 정보가 삭제됩니다</li>
                  <li>토큰 잔액 정보가 삭제됩니다</li>
                  <li>작성한 질문과 답변은 유지됩니다</li>
                  <li>이 작업은 되돌릴 수 없습니다</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteAccountOpen(false)}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '회원탈퇴'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </ProtectedPage>
  )
}
