'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type RankProfile = {
  userName: string
  avatarUrl: string | null
}

export default function LeaderboardPage() {
  const [monthlyRanking, setMonthlyRanking] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Record<string, RankProfile>>({})

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true)
        setError(null)

        const monthlyRes = await fetch('/api/ranking/monthly')

        if (!monthlyRes.ok) {
          console.error('[리더보드] 랭킹 API 오류:', {
            monthly: monthlyRes.status,
          })
          setError('랭킹 데이터를 불러오지 못했습니다.')
          return
        }

        const monthlyData = await monthlyRes.json()

        setMonthlyRanking(monthlyData.top || [])
      } catch (err) {
        console.error('[리더보드] 랭킹 조회 실패:', err)
        setError('랭킹 데이터를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadRankings()
  }, [])

  // 각 랭킹 유저의 프로필 정보(닉네임/아바타) 로드
  useEffect(() => {
    const loadProfiles = async () => {
      const all = [...monthlyRanking]
      if (all.length === 0) {
        setProfiles({})
        return
      }

      const uniqueAddresses = Array.from(
        new Set(all.map((u) => u.address.toLowerCase()))
      )

      const next: Record<string, RankProfile> = {}

      await Promise.all(
        uniqueAddresses.map(async (addr) => {
          try {
            const res = await fetch(
              `/api/users/by-wallet?walletAddress=${encodeURIComponent(addr)}`
            )
            if (!res.ok) return
            const data = await res.json()
            if (data.user) {
              next[addr] = {
                userName: data.user.userName || '',
                avatarUrl: data.user.avatarUrl || null,
              }
            }
          } catch (e) {
            console.warn('[리더보드] 프로필 조회 실패:', addr, e)
          }
        })
      )

      setProfiles(next)
    }

    loadProfiles()
  }, [monthlyRanking])

  const currentRanking = useMemo(() => monthlyRanking, [monthlyRanking])
  const topUsers = currentRanking.slice(0, 3)

  const title = '이달의 리더보드'

  return (
    <div className="bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <div className="mb-20 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Trophy className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-1 text-4xl font-bold ">{title}</h1>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            랭킹 데이터를 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : currentRanking.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            아직 표시할 랭킹 데이터가 없습니다
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-6 md:grid-cols-3">
              {topUsers.map((user) => {
                const profile = profiles[user.address.toLowerCase()]

                const displayName =
                  profile?.userName?.trim() ||
                  user.userName ||
                  `${user.address.slice(0, 6)}...${user.address.slice(-4)}`

                const avatarSrc = profile?.avatarUrl || undefined

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
                            <AvatarImage src={avatarSrc} />
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
          </>
        )}
      </div>
    </div>
  )
}
