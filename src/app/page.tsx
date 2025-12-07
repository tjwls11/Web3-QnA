'use client'

import type React from 'react'

import { useMemo, useState, useEffect } from 'react'
import { Header } from '@/components/header'
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
import { useContract } from '@/hooks/useContract'
import * as storage from '@/lib/storage'

type WeeklyRankItem = {
  address: string
  userName: string
  answersCount: number
  acceptedCount: number
  score: number
  rank: number
}

type RankProfile = {
  userName: string
  avatarUrl: string | null
}

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

export default function HomePage() {
  const router = useRouter()
  const { isConnected, address } = useWallet()
  const { addBookmark, removeBookmark, isBookmarked } = useContract()

  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(
    new Set()
  )
  const [filter, setFilter] = useState<'latest' | 'unanswered'>('latest')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [questionAuthors, setQuestionAuthors] = useState<
    Record<string, { userName: string; avatarUrl: string | null }>
  >({})
  const [weeklyRanking, setWeeklyRanking] = useState<WeeklyRankItem[]>([])
  const [weeklyRankingLoading, setWeeklyRankingLoading] = useState(true)
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [weeklyProfiles, setWeeklyProfiles] = useState<
    Record<string, RankProfile>
  >({})
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)

  // 🔍 검색어
  const [searchTerm, setSearchTerm] = useState('')
  // 📄 페이지네이션
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  // 질문 목록 + 작성자 정보 + 북마크 상태 로드
  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoadingQuestions(true)
      try {
        const allQuestions = await storage.getQuestions()

        // 최신순 정렬
        const sortedQuestions = allQuestions.sort(
          (a: any, b: any) => Number(b.createdAt) - Number(a.createdAt)
        )

        // 작성자 주소 dedup 후 프로필 조회
        const authorsInfo: Record<
          string,
          { userName: string; avatarUrl: string | null }
        > = {}

        const uniqueAuthors = Array.from(
          new Set(
            sortedQuestions
              .map((q: any) => q.author)
              .filter(Boolean)
              .map((addr: string) => addr.toLowerCase())
          )
        )

        await Promise.all(
          uniqueAuthors.map(async (authorLower) => {
            try {
              const res = await fetch(
                `/api/users/by-wallet?walletAddress=${encodeURIComponent(
                  authorLower
                )}`
              )

              if (!res.ok) {
                authorsInfo[authorLower] = {
                  userName:
                    authorLower.slice(0, 6) + '...' + authorLower.slice(-4),
                  avatarUrl: null,
                }
                return
              }

              const data = await res.json()
              const user = data.user

              authorsInfo[authorLower] = {
                userName:
                  user?.userName ??
                  authorLower.slice(0, 6) + '...' + authorLower.slice(-4),
                avatarUrl: user?.avatarUrl ?? null,
              }
            } catch (error) {
              console.error('작성자 정보 로드 실패:', authorLower, error)
              authorsInfo[authorLower] = {
                userName:
                  authorLower.slice(0, 6) + '...' + authorLower.slice(-4),
                avatarUrl: null,
              }
            }
          })
        )

        setQuestionAuthors(authorsInfo)
        setQuestions(sortedQuestions)

        // 북마크 상태 병렬 조회
        if (address) {
          try {
            const results = await Promise.all(
              sortedQuestions.map((q: any) =>
                isBookmarked(q.id, address).catch((err: any) => {
                  console.error('isBookmarked 에러:', q.id, err)
                  return false
                })
              )
            )

            const bookmarked = new Set<string>()
            results.forEach((isBooked, idx) => {
              if (isBooked) {
                bookmarked.add(sortedQuestions[idx].id.toString())
              }
            })

            setBookmarkedQuestions(bookmarked)
          } catch (err) {
            console.error('북마크 상태 조회 실패:', err)
          }
        } else {
          setBookmarkedQuestions(new Set())
        }

        // 인기 태그 계산
        const tagCount: Record<string, number> = {}
        for (const q of sortedQuestions) {
          const tags = Array.isArray(q.tags) ? q.tags : []
          for (const rawTag of tags) {
            const normalized = String(rawTag).trim()
            if (!normalized) continue
            tagCount[normalized] = (tagCount[normalized] || 0) + 1
          }
        }

        const sortedTags = Object.entries(tagCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([tag]) => tag)

        setPopularTags(sortedTags)
      } catch (error) {
        console.error('질문 목록 로드 실패:', error)
        setQuestions([])
        setQuestionAuthors({})
        setPopularTags([])
        setBookmarkedQuestions(new Set())
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadQuestions()
  }, [address, isBookmarked])

  // 이번 주 랭킹 로드
  useEffect(() => {
    const loadWeeklyRanking = async () => {
      try {
        const response = await fetch('/api/ranking/weekly')
        if (!response.ok) {
          console.error('[주간 랭킹] API 오류:', response.status)
          setWeeklyRanking([])
          return
        }
        const data = await response.json()
        setWeeklyRanking(data.top || [])
      } catch (error) {
        console.error('[주간 랭킹] 조회 실패:', error)
        setWeeklyRanking([])
      } finally {
        setWeeklyRankingLoading(false)
      }
    }

    loadWeeklyRanking()
  }, [])

  // 주간 랭킹 유저 프로필 로드
  useEffect(() => {
    const loadProfiles = async () => {
      if (!weeklyRanking || weeklyRanking.length === 0) {
        setWeeklyProfiles({})
        return
      }

      const uniqueAddresses = Array.from(
        new Set(weeklyRanking.map((u) => u.address.toLowerCase()))
      )

      const nextProfiles: Record<string, RankProfile> = {}

      await Promise.all(
        uniqueAddresses.map(async (addr) => {
          try {
            const res = await fetch(
              `/api/users/by-wallet?walletAddress=${encodeURIComponent(addr)}`
            )
            if (!res.ok) return
            const data = await res.json()
            if (data.user) {
              nextProfiles[addr] = {
                userName: data.user.userName || '',
                avatarUrl: data.user.avatarUrl || null,
              }
            }
          } catch (e) {
            console.warn('[주간 랭킹] 프로필 조회 실패:', addr, e)
          }
        })
      )

      setWeeklyProfiles(nextProfiles)
    }

    loadProfiles()
  }, [weeklyRanking])

  // 필터/태그/검색 바뀌면 1페이지로 이동
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, selectedTag, searchTerm])

  const handleBookmark = async (
    questionId: bigint,
    e: React.MouseEvent
  ): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()

    if (!isConnected || !address) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('openWalletModal')
        window.dispatchEvent(event)
      }
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

  // 필터 + 검색 + 태그 필터까지 적용한 질문 목록
  const filteredQuestions = useMemo(() => {
    // 1) 최근/미답변 필터
    let base =
      filter === 'unanswered'
        ? questions.filter(
            (q) => q.status === 'open' && Number(q.answerCount) === 0
          )
        : questions

    // 2) 태그 필터
    if (selectedTag) {
      base = base.filter((q) => {
        const tags = Array.isArray(q.tags) ? q.tags : []
        return tags.includes(selectedTag)
      })
    }

    // 3) 검색 필터 (제목 / 내용 / 태그)
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      base = base.filter((q) => {
        const title = String(q.title || '').toLowerCase()
        const content = String(q.content || '').toLowerCase()
        const tags = Array.isArray(q.tags) ? q.tags : []
        const tagMatch = tags.some((tag: string) =>
          String(tag).toLowerCase().includes(term)
        )
        return title.includes(term) || content.includes(term) || tagMatch
      })
    }

    return base
  }, [filter, questions, selectedTag, searchTerm])

  // 페이지 수
  const pageCount = useMemo(() => {
    if (filteredQuestions.length === 0) return 1
    return Math.ceil(filteredQuestions.length / PAGE_SIZE)
  }, [filteredQuestions, PAGE_SIZE])

  // 현재 페이지에 해당하는 질문들
  const pagedQuestions = useMemo(() => {
    if (filteredQuestions.length === 0) return []
    const safePage = Math.min(currentPage, pageCount)
    const start = (safePage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredQuestions.slice(start, end)
  }, [filteredQuestions, currentPage, pageCount, PAGE_SIZE])

  // 실제 데이터 기반 인기 질문 (답변 수 기준 상위 5개)
  const popularQuestions = useMemo(() => {
    if (!questions || questions.length === 0) return []

    const withAnswers = questions.filter((q) => Number(q.answerCount || 0) > 0)

    const sorted = [...withAnswers].sort(
      (a, b) => Number(b.answerCount || 0) - Number(a.answerCount || 0)
    )

    return sorted.slice(0, 5)
  }, [questions])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          {/* 많이 본 Q&A 섹션 */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              많이 본 Q&A
            </h2>
            <div className="relative">
              {popularQuestions.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground text-center">
                    아직 인기 질문이 없습니다. 첫 번째 질문을 남겨보세요!
                  </CardContent>
                </Card>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                  {popularQuestions.map((question: any) => {
                    const answerCount = Number(question.answerCount || 0)
                    const viewCount = Number(question.viewCount || 0)
                    const questionIdStr = question.id.toString()
                    const tags = Array.isArray(question.tags)
                      ? question.tags
                      : []

                    return (
                      <Link
                        key={questionIdStr}
                        href={`/question/${questionIdStr}`}
                        className="snap-start"
                      >
                        <Card className="w-[280px] shrink-0 h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-sm mb-3 line-clamp-2 leading-tight min-h-10">
                              {question.title}
                            </h3>
                            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {answerCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {viewCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                {tags.slice(0, 2).map((tag: string) => (
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
                                <span>
                                  {Number(question.reward || 0) / 1e18} WAK
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 검색 / 필터 */}
          <div className="mb-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="궁금한 것을 검색해보세요"
                className="h-12 pl-10 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1)
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
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
              {selectedTag && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">태그 필터:</span>
                  <Badge variant="secondary">#{selectedTag}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setSelectedTag(null)}
                  >
                    필터 해제
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* 메인 질문 리스트 */}
            <main>
              <div className="space-y-4">
                {isLoadingQuestions ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      질문을 불러오는 중입니다...
                    </CardContent>
                  </Card>
                ) : filteredQuestions.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      아직 등록된 질문이 없습니다.
                    </CardContent>
                  </Card>
                ) : (
                  pagedQuestions.map((question: any, index: number) => {
                    const authorLower = question.author.toLowerCase()
                    const authorInfo = questionAuthors[authorLower] || {
                      userName:
                        authorLower.slice(0, 6) + '...' + authorLower.slice(-4),
                      avatarUrl: null,
                    }

                    const questionIdStr = question.id.toString()
                    const isBooked = bookmarkedQuestions.has(questionIdStr)
                    const timeAgo = getTimeAgo(Number(question.createdAt))
                    const answerCount = Number(question.answerCount) || 0
                    const tags = Array.isArray(question.tags)
                      ? question.tags
                      : []

                    return (
                      <Link
                        key={`${questionIdStr}-${index}`}
                        href={`/question/${questionIdStr}`}
                      >
                        <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex gap-3">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage
                                  src={authorInfo.avatarUrl || undefined}
                                />
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
                                      <AvatarImage
                                        src={authorInfo.avatarUrl || undefined}
                                      />
                                      <AvatarFallback className="text-[10px]">
                                        {authorInfo.userName[0]?.toUpperCase() ||
                                          '?'}
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
                                    {tags.map((tag: string) => {
                                      const isActive = selectedTag === tag
                                      return (
                                        <Badge
                                          key={tag}
                                          variant={
                                            isActive ? 'default' : 'secondary'
                                          }
                                          className="text-xs px-2 py-0 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setSelectedTag((prev) =>
                                              prev === tag ? null : tag
                                            )
                                          }}
                                        >
                                          {tag}
                                        </Badge>
                                      )
                                    })}
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

              {/* 실제 개수 기반 페이지네이션 */}
              {filteredQuestions.length > PAGE_SIZE && (
                <div className="mt-8 flex justify-center gap-2">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>
              )}
            </main>

            {/* 오른쪽 사이드바 */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start hidden lg:block">
              {/* 인기 태그 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    인기 태그
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {popularTags.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      아직 인기 태그가 없습니다. 첫 번째 질문을 남겨보세요!
                    </div>
                  ) : (
                    popularTags.map((tag) => {
                      const isActive = selectedTag === tag
                      return (
                        <Badge
                          key={tag}
                          variant={isActive ? 'default' : 'outline'}
                          className="mr-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() =>
                            setSelectedTag((prev) =>
                              prev === tag ? null : tag
                            )
                          }
                        >
                          #{tag}
                        </Badge>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              {/* 이번 주 순위 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">
                    이번 주 순위
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyRankingLoading ? (
                    <div className="text-sm text-muted-foreground">
                      이번 주 활동 데이터를 불러오는 중입니다...
                    </div>
                  ) : weeklyRanking.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      아직 이번 주에 기록된 답변이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weeklyRanking.slice(0, 5).map((user) => {
                        const profile =
                          weeklyProfiles[user.address.toLowerCase()]

                        const displayName =
                          profile?.userName?.trim() ||
                          user.userName ||
                          `${user.address.slice(0, 6)}...${user.address.slice(
                            -4
                          )}`

                        const avatarSrc = profile?.avatarUrl || undefined

                        return (
                          <div
                            key={user.address}
                            className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-base font-bold w-6 ${
                                  user.rank <= 3
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {user.rank}
                              </span>
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarSrc} />
                                <AvatarFallback>
                                  {displayName[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                  {displayName}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  답변 {user.answersCount}개 · 채택{' '}
                                  {user.acceptedCount}개
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                              <Coins className="h-3 w-3" />
                              <span>{user.score}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
