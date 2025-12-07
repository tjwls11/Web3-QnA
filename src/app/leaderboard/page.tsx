'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, Coins, Award, Crown } from 'lucide-react'

type RankItem = {
  address: string
  userName: string
  answersCount: number
  acceptedCount: number
  score: number
  rank: number
}

type TabValue = 'overall' | 'month' | 'week'

type RankingResponse = {
  top: RankItem[]
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('overall')
  const [overallRanking, setOverallRanking] = useState<RankItem[]>([])
  const [monthlyRanking, setMonthlyRanking] = useState<RankItem[]>([])
  const [weeklyRanking, setWeeklyRanking] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true)
        setError(null)

        const [overallRes, monthlyRes, weeklyRes] = await Promise.all([
          fetch('/api/ranking/overall'),
          fetch('/api/ranking/monthly'),
          fetch('/api/ranking/weekly'),
        ])

        if (!overallRes.ok || !monthlyRes.ok || !weeklyRes.ok) {
          console.error('[리더보드] 랭킹 API 오류:', {
            overall: overallRes.status,
            monthly: monthlyRes.status,
            weekly: weeklyRes.status,
          })
          setError('랭킹 데이터를 불러오지 못했습니다.')
          return
        }

        const [overallData, monthlyData, weeklyData]: RankingResponse[] =
          await Promise.all([
            overallRes.json(),
            monthlyRes.json(),
            weeklyRes.json(),
          ])

        setOverallRanking(overallData.top || [])
        setMonthlyRanking(monthlyData.top || [])
        setWeeklyRanking(weeklyData.top || [])
      } catch (err) {
        console.error('[리더보드] 랭킹 조회 실패:', err)
        setError('랭킹 데이터를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadRankings()
  }, [])

  const currentRanking = useMemo(() => {
    switch (activeTab) {
      case 'month':
        return monthlyRanking
      case 'week':
        return weeklyRanking
      default:
        return overallRanking
    }
  }, [activeTab, overallRanking, monthlyRanking, weeklyRanking])

  const topUsers = currentRanking.slice(0, 3)
  const restUsers = currentRanking.slice(3)

  const titleByTab: Record<TabValue, string> = {
    overall: '리더보드',
    month: '이달의 리더보드',
    week: '이번 주 리더보드',
  }

  const listTitleByTab: Record<TabValue, string> = {
    overall: '전체 랭킹',
    month: '이번 달 랭킹',
    week: '이번 주 랭킹',
  }

  const listDescriptionByTab: Record<TabValue, string> = {
    overall: '전체 기간 기준 상위 100명',
    month: '이번 달 기준 상위 100명',
    week: '최근 7일 기준 상위 100명',
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 lg:px-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Trophy className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-2 text-4xl font-bold">{titleByTab[activeTab]}</h1>
        </div>

        <Tabs
          defaultValue="overall"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="overall">전체</TabsTrigger>
            <TabsTrigger value="month">이번 달</TabsTrigger>
            <TabsTrigger value="week">이번 주</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            랭킹 데이터를 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="text-center text-sm text-destructive py-12">
            {error}
          </div>
        ) : currentRanking.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            아직 표시할 랭킹 데이터가 없습니다. 첫 번째 답변을 남겨보세요!
          </div>
        ) : (
          <>
            {/* Top 3 특별 표시 */}
            <div className="mb-12 grid gap-6 md:grid-cols-3">
              {topUsers.map((user) => {
                const displayName =
                  user.userName ||
                  `${user.address.slice(0, 6)}...${user.address.slice(-4)}`

                return (
                  <Card
                    key={user.rank}
                    className={`relative overflow-hidden ${
                      user.rank === 1
                        ? 'border-yellow-500 shrink-0 from-yellow-500/10 to-transparent'
                        : user.rank === 2
                        ? 'border-gray-400 shrink-0 from-gray-400/10 to-transparent'
                        : 'border-orange-600 shrink-0 from-orange-600/10 to-transparent'
                    }`}
                  >
                    {user.rank === 1 && (
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-yellow-500/20" />
                    )}
                    <CardHeader className="text-center">
                      <div className="mb-4 flex justify-center">
                        <div className="relative">
                          <Avatar className="h-20 w-20 border-4 border-background">
                            <AvatarImage src={undefined} />
                            <AvatarFallback>
                              {displayName[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full ${
                              user.rank === 1
                                ? 'bg-yellow-500 text-yellow-950'
                                : user.rank === 2
                                ? 'bg-gray-400 text-gray-900'
                                : 'bg-orange-600 text-orange-50'
                            } font-bold shadow-lg`}
                          >
                            {user.rank === 1 ? (
                              <Crown className="h-6 w-6" />
                            ) : (
                              `#${user.rank}`
                            )}
                          </div>
                        </div>
                      </div>
                      <CardTitle className="mb-1">{displayName}</CardTitle>
                      <Badge variant="secondary">
                        점수 {user.score.toLocaleString()}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              점수
                            </span>
                          </div>
                          <span className="font-bold text-primary">
                            {user.score.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              답변
                            </span>
                          </div>
                          <span className="font-semibold">
                            {user.answersCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              채택
                            </span>
                          </div>
                          <span className="font-semibold">
                            {user.acceptedCount}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* 전체 랭킹 테이블 */}
            <Card>
              <CardHeader>
                <CardTitle>{listTitleByTab[activeTab]}</CardTitle>
                <CardDescription>
                  {listDescriptionByTab[activeTab]}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {restUsers.map((user) => {
                    const displayName =
                      user.userName ||
                      `${user.address.slice(0, 6)}...${user.address.slice(-4)}`

                    return (
                      <div
                        key={user.rank}
                        className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex w-8 items-center justify-center">
                            <span className="text-lg font-bold text-muted-foreground">
                              #{user.rank}
                            </span>
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={undefined} />
                            <AvatarFallback>
                              {displayName[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              답변 {user.answersCount}개 · 채택{' '}
                              {user.acceptedCount}개
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-primary">
                              {user.score.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              점수
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">
                              {user.answersCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              답변
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold">
                              {user.acceptedCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              채택
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
