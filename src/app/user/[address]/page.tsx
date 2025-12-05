'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MessageSquare,
  Coins,
  Calendar,
  Award,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import * as storage from '@/lib/storage'

export default function UserProfilePage() {
  const params = useParams()
  const address = params?.address as string
  const [userInfo, setUserInfo] = useState<{
    userName: string
    avatarUrl: string | null
  } | null>(null)
  const [userQuestions, setUserQuestions] = useState<any[]>([])
  const [userAnswers, setUserAnswers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      if (!address) return

      setLoading(true)
      try {
        // 사용자 정보 조회
        const response = await fetch(`/api/users/by-wallet?walletAddress=${encodeURIComponent(address)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUserInfo(data.user)
          } else {
            setUserInfo({
              userName: address.slice(0, 6) + '...' + address.slice(-4),
              avatarUrl: null,
            })
          }
        }

        // 사용자 질문 조회
        const questions = await storage.getUserQuestions(address)
        setUserQuestions(questions)

        // 사용자 답변 조회
        const answers = await storage.getUserAnswers(address)
        setUserAnswers(answers)
      } catch (error) {
        console.error('사용자 데이터 로드 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [address])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              로딩 중...
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  const displayName = userInfo?.userName || address.slice(0, 6) + '...' + address.slice(-4)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* 프로필 헤더 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={userInfo?.avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {displayName[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold mb-2">{displayName}</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {address}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 탭 */}
        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="questions">
              질문 ({userQuestions.length})
            </TabsTrigger>
            <TabsTrigger value="answers">
              답변 ({userAnswers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            {userQuestions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  등록한 질문이 없습니다.
                </CardContent>
              </Card>
            ) : (
              userQuestions.map((question) => (
                <Link key={question.id.toString()} href={`/question/${question.id}`}>
                  <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">{question.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {Number(question.answerCount)}개 답변
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(Number(question.createdAt)).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <Coins className="h-4 w-4" />
                          {Number(question.reward) / 1e18} WAK
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>

          <TabsContent value="answers" className="space-y-4">
            {userAnswers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  작성한 답변이 없습니다.
                </CardContent>
              </Card>
            ) : (
              userAnswers.map((answer) => (
                <Link
                  key={answer.id.toString()}
                  href={`/question/${answer.questionId}`}
                >
                  <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        {answer.questionTitle || '질문 제목 없음'}
                      </p>
                      <p className="line-clamp-2">{answer.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(Number(answer.createdAt)).toLocaleDateString()}
                        {answer.isAccepted && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary">
                              <Award className="h-3 w-3" />
                              채택됨
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  )
}




