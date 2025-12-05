'use client'

import type React from 'react'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  MessageSquare,
  Coins,
  Search,
  TrendingUp,
  Eye,
  Heart,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet-context'
import { WalletRequiredModal } from '@/components/wallet-required-modal'
import { useContract } from '@/hooks/useContract'
import * as storage from '@/lib/storage'
import { useEffect } from 'react'

// 시간 경과 계산 함수
function getTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  return `${days}일 전`
}

const popularQuestions = [
  {
    id: 1,
    title: 'React에서 useEffect와 useLayoutEffect의 차이점은?',
    author: '개발자123',
    tags: ['React', 'Hooks'],
    reward: 50,
    views: 2450,
    answers: 12,
  },
  {
    id: 2,
    title: 'TypeScript 제네릭 타입 추론 문제',
    author: 'TS고수',
    tags: ['TypeScript', 'Generic'],
    reward: 100,
    views: 1890,
    answers: 8,
  },
  {
    id: 3,
    title: 'Next.js 15 App Router 동적 라우팅',
    author: '프론트개발자',
    tags: ['Next.js', 'React'],
    reward: 75,
    views: 1650,
    answers: 15,
  },
  {
    id: 4,
    title: 'Web3.js vs Ethers.js 비교',
    author: '블록체인초보',
    tags: ['Blockchain', 'Web3'],
    reward: 150,
    views: 1420,
    answers: 6,
  },
  {
    id: 5,
    title: 'Django JWT 인증 구현 방법',
    author: '백엔드개발자',
    tags: ['Python', 'Django'],
    reward: 80,
    views: 1280,
    answers: 10,
  },
]

export default function HomePage() {
  const router = useRouter()
  const { isConnected, address } = useWallet()
  const { addBookmark, removeBookmark, isBookmarked } = useContract()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [filter, setFilter] = useState<'latest' | 'unanswered'>('latest')
  const [questions, setQuestions] = useState<any[]>([])
  const [questionAuthors, setQuestionAuthors] = useState<Record<string, { userName: string; avatarUrl: string | null }>>({})

  // 질문 목록 로드
  useEffect(() => {
    const loadQuestions = async () => {
      const allQuestions = await storage.getQuestions()
      // 최신순으로 정렬
      const sortedQuestions = allQuestions.sort((a, b) => {
        return Number(b.createdAt) - Number(a.createdAt)
      })

      // 찜하기 상태 확인
      if (address) {
        const bookmarked = new Set<string>()
        for (const q of sortedQuestions) {
          const isBooked = await isBookmarked(q.id, address)
          if (isBooked) {
            bookmarked.add(q.id.toString())
          }
        }
        setBookmarkedQuestions(bookmarked)
      }

      // 질문 작성자 정보 로드
      const authorsInfo: Record<string, { userName: string; avatarUrl: string | null }> = {}
      await Promise.all(
        sortedQuestions.map(async (q) => {
          try {
            const response = await fetch(`/api/users/by-wallet?walletAddress=${encodeURIComponent(q.author)}`)
            if (response.ok) {
              const data = await response.json()
              if (data.user) {
                authorsInfo[q.author.toLowerCase()] = {
                  userName: data.user.userName || q.author.slice(0, 6) + '...' + q.author.slice(-4),
                  avatarUrl: data.user.avatarUrl || null,
                }
              } else {
                authorsInfo[q.author.toLowerCase()] = {
                  userName: q.author.slice(0, 6) + '...' + q.author.slice(-4),
                  avatarUrl: null,
                }
              }
            } else {
              authorsInfo[q.author.toLowerCase()] = {
                userName: q.author.slice(0, 6) + '...' + q.author.slice(-4),
                avatarUrl: null,
              }
            }
          } catch (error) {
            console.error('작성자 정보 로드 실패:', error)
            authorsInfo[q.author.toLowerCase()] = {
              userName: q.author.slice(0, 6) + '...' + q.author.slice(-4),
              avatarUrl: null,
            }
          }
        })
      )
      setQuestionAuthors(authorsInfo)
      setQuestions(sortedQuestions)
    }

    loadQuestions()
  }, [address, isBookmarked])

  const handleBookmark = async (questionId: bigint, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isConnected || !address) {
      setShowWalletModal(true)
      return
    }

    try {
      const questionIdStr = questionId.toString()
      if (bookmarkedQuestions.has(questionIdStr)) {
        await removeBookmark(questionId, address)
        setBookmarkedQuestions((prev) => {
          const newSet = new Set(prev)
          newSet.delete(questionIdStr)
          return newSet
        })
      } else {
        await addBookmark(questionId, address)
        setBookmarkedQuestions((prev) => {
          const newSet = new Set(prev)
          newSet.add(questionIdStr)
          return newSet
        })
      }
    } catch (error) {
      console.error('찜하기 실패:', error)
    }
  }

  const filteredQuestions =
    filter === 'unanswered'
      ? questions.filter(
          (q) => q.status === 'open' && Number(q.answerCount) === 0
        )
      : questions

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {showWalletModal && (
        <WalletRequiredModal onClose={() => setShowWalletModal(false)} />
      )}

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            많이 본 Q&A
          </h2>
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {popularQuestions.map((question) => (
                <Link
                  key={question.id}
                  href={`/question/${question.id}`}
                  className="snap-start"
                >
                  <Card className="w-[280px] shrink-0 h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 leading-tight min-h-10">
                        {question.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {question.views.toLocaleString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {question.answers}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {question.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs px-2 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <Coins className="h-4 w-4" />
                          <span>{question.reward} WAK</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="궁금한 것을 검색해보세요"
              className="h-12 pl-10 text-base"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={filter === 'latest' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('latest')}
            >
              최근순
            </Button>
            <Button
              variant={filter === 'unanswered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unanswered')}
            >
              미답변
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <main>
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    질문이 없습니다.
                  </CardContent>
                </Card>
              ) : (
                filteredQuestions.map((question) => {
                  const authorInfo = questionAuthors[question.author.toLowerCase()] || {
                    userName: question.author.slice(0, 6) + '...' + question.author.slice(-4),
                    avatarUrl: null,
                  }
                  const questionIdStr = question.id.toString()
                  const isBooked = bookmarkedQuestions.has(questionIdStr)
                  const timeAgo = getTimeAgo(Number(question.createdAt))
                  
                  // DB에서 실제 답변 수 가져오기 (question.answerCount 사용)
                  const answerCount = Number(question.answerCount) || 0

                  return (
                    <Link
                      key={questionIdStr}
                      href={`/question/${questionIdStr}`}
                    >
                      <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={authorInfo.avatarUrl || undefined} />
                              <AvatarFallback>
                                {authorInfo.userName[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-1">
                                <h3 className="font-semibold text-base hover:text-primary transition-colors">
                                  {question.title}
                                </h3>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) =>
                                      handleBookmark(question.id, e)
                                    }
                                  >
                                    <Heart
                                      className={`h-4 w-4 ${
                                        isBooked
                                          ? 'fill-primary text-primary'
                                          : ''
                                      }`}
                                    />
                                  </Button>
                                  <div className="flex items-center gap-1 text-primary font-bold">
                                    <Coins className="h-4 w-4" />
                                    <span className="text-sm">
                                      {Number(question.reward) / 1e18} WAK
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                {question.content}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    router.push(`/user/${question.author}`)
                                  }}
                                  className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={authorInfo.avatarUrl || undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {authorInfo.userName[0]?.toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {authorInfo.userName}
                                </span>
                                <span>•</span>
                                <span>{timeAgo}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {answerCount}
                                </span>
                                {isBooked && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-primary">
                                      <Heart className="h-3 w-3 fill-primary" />
                                      저도 궁금해요
                                    </span>
                                  </>
                                )}
                                <div className="flex gap-1 ml-auto">
                                  {question.tags.map((tag: string) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-xs px-2 py-0"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              )}
            </div>

            <div className="mt-8 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((page) => (
                <Button
                  key={page}
                  variant={page === 1 ? 'default' : 'outline'}
                  size="sm"
                >
                  {page}
                </Button>
              ))}
            </div>
          </main>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start hidden lg:block">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  인기 태그
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  'React',
                  'TypeScript',
                  'Next.js',
                  'Python',
                  'Blockchain',
                  'JavaScript',
                  'Node.js',
                  'Web3',
                  'Docker',
                  'AWS',
                ].map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="mr-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    #{tag}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  이번 주 순위
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      name: '개발자1',
                      tokens: 450,
                      avatar: '/placeholder.svg?height=32&width=32',
                    },
                    {
                      name: '개발자2',
                      tokens: 380,
                      avatar: '/placeholder.svg?height=32&width=32',
                    },
                    {
                      name: '개발자3',
                      tokens: 320,
                      avatar: '/placeholder.svg?height=32&width=32',
                    },
                    {
                      name: '개발자4',
                      tokens: 280,
                      avatar: '/placeholder.svg?height=32&width=32',
                    },
                    {
                      name: '개발자5',
                      tokens: 245,
                      avatar: '/placeholder.svg?height=32&width=32',
                    },
                  ].map((user, index) => (
                    <div
                      key={user.name}
                      className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-base font-bold w-6 ${
                            index < 3 ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={user.avatar || '/placeholder.svg'}
                          />
                          <AvatarFallback>{user.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{user.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                        <Coins className="h-3 w-3" />
                        {user.tokens}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  )
}
