'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useWallet } from '@/lib/wallet-context'
import { useContract } from '@/hooks/useContract'
import * as storage from '@/lib/storage'
import {
  Heart,
  Calendar,
  MessageSquare,
  Coins,
  Award,
  TrendingUp,
  Tag,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/header'
import { Footer } from '@/components/footer'

export default function QuestionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isConnected, address, userName } = useWallet()
  const {
    getQuestion,
    createAnswer,
    acceptAnswer,
    addBookmark,
    removeBookmark,
    isBookmarked: checkBookmarked,
    isLoading,
  } = useContract()
  const [answer, setAnswer] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [question, setQuestion] = useState<any>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 질문 및 답변 로드
  useEffect(() => {
    const loadData = async () => {
      if (!params?.id) return

      setLoading(true)
      try {
        const questionId = BigInt(params.id.toString())
        const questionData = await getQuestion(questionId)

        if (questionData) {
          setQuestion(questionData)

          // 답변 로드
          const questionAnswers = storage.getAnswersByQuestionId(
            params.id.toString()
          )
          setAnswers(questionAnswers)

          // 찜하기 상태 확인
          if (address) {
            const bookmarked = await checkBookmarked(questionId, address)
            setIsBookmarked(bookmarked)
          }
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params?.id, address, getQuestion, checkBookmarked])

  const relatedQuestions = [
    {
      id: 2,
      title: 'useEffect cleanup 함수는 언제 사용하나요?',
      answers: 5,
      reward: 30,
    },
    { id: 3, title: 'React 18의 새로운 기능은?', answers: 8, reward: 100 },
    { id: 4, title: 'useState vs useReducer 차이점', answers: 12, reward: 45 },
  ]

  const popularTags = [
    { name: 'React', count: 1234 },
    { name: 'JavaScript', count: 2341 },
    { name: 'TypeScript', count: 987 },
    { name: 'Next.js', count: 654 },
    { name: 'Node.js', count: 543 },
  ]

  const handleSubmitAnswer = async () => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }
    if (!answer.trim()) return
    if (!question) return

    try {
      const questionId = BigInt(question.id.toString())
      const answerId = await createAnswer(questionId, answer, address)

      if (answerId) {
        alert('답변이 등록되었습니다!')
        setAnswer('')

        // 답변 목록 새로고침
        const questionAnswers = storage.getAnswersByQuestionId(
          question.id.toString()
        )
        setAnswers(questionAnswers)

        // 질문의 답변 수 업데이트
        const updatedQuestion = await getQuestion(questionId)
        if (updatedQuestion) {
          setQuestion(updatedQuestion)
        }
      }
    } catch (error) {
      console.error('답변 작성 실패:', error)
      alert('답변 작성에 실패했습니다.')
    }
  }

  const handleAcceptAnswer = async (answerId: bigint) => {
    if (!isConnected || !address || !question) return

    if (address.toLowerCase() !== question.author.toLowerCase()) {
      alert('질문 작성자만 답변을 채택할 수 있습니다.')
      return
    }

    try {
      const questionId = BigInt(question.id.toString())
      const success = await acceptAnswer(questionId, answerId)
      if (success) {
        const rewardAmount = Number(question.reward) / 1e18
        alert(
          `답변이 채택되었습니다! ${rewardAmount} WAK 토큰이 답변자에게 전송됩니다.`
        )

        // 답변 목록 새로고침
        const questionAnswers = storage.getAnswersByQuestionId(
          question.id.toString()
        )
        setAnswers(questionAnswers)
        
        // 질문 상태 업데이트
        const updatedQuestion = await getQuestion(questionId)
        if (updatedQuestion) {
          setQuestion(updatedQuestion)
        }
      }
    } catch (error: any) {
      console.error('답변 채택 실패:', error)
      alert(error.message || '답변 채택에 실패했습니다.')
    }
  }

  const handleBookmark = async () => {
    if (!isConnected || !address || !question) {
      alert('지갑을 연결해주세요.')
      return
    }

    try {
      const questionId = BigInt(question.id.toString())
      if (isBookmarked) {
        await removeBookmark(questionId, address)
        setIsBookmarked(false)
      } else {
        await addBookmark(questionId, address)
        setIsBookmarked(true)
      }
    } catch (error) {
      console.error('찜하기 실패:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">질문을 찾을 수 없습니다.</p>
            <Button onClick={() => router.push('/')} className="mt-4">
              목록으로 돌아가기
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // 작성자 정보 가져오기
  const authorInfo = question
    ? storage.getUserInfo(question.author) || {
        userName: question.author.slice(0, 6) + '...' + question.author.slice(-4),
      }
    : { userName: '...' }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* 질문 카드 */}
            <Card className="p-8 mb-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-4 text-balance">
                    {question.title}
                  </h1>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {question.tags.map((tag: string) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-3 py-1"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant={isBookmarked ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleBookmark}
                >
                  <Heart
                    className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`}
                  />
                </Button>
              </div>

              <div className="mb-6 whitespace-pre-wrap text-sm leading-relaxed">
                {question.content}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <Link
                    href="/my-page"
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {authorInfo?.userName?.[0] || question.author[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {authorInfo?.userName || question.author.slice(0, 6) + '...' + question.author.slice(-4)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {question.author.slice(0, 6)}...
                        {question.author.slice(-4)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(Number(question.createdAt)).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    {question.answerCount.toString()}
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-primary">
                    <Coins className="h-4 w-4" />
                    {Number(question.reward) / 1e18} WAK
                  </div>
                </div>
              </div>
            </Card>

            {/* 답변 목록 */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-6">
                {answers.length}개의 답변
              </h2>
              <div className="space-y-4">
                {answers.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    아직 답변이 없습니다.
                  </Card>
                ) : (
                  answers.map((ans) => {
                    const answerAuthorInfo = storage.getUserInfo(
                      ans.author
                    ) || {
                      userName:
                        ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
                    }
                    return (
                      <Card key={ans.id.toString()} className="p-6 shadow-sm">
                        {ans.isAccepted && (
                          <div className="flex items-center gap-2 text-green-600 mb-4 bg-green-50 dark:bg-green-950 p-2 rounded">
                            <Award className="h-5 w-5" />
                            <span className="text-sm font-semibold">
                              채택된 답변
                            </span>
                          </div>
                        )}

                        <div className="mb-4 whitespace-pre-wrap text-sm leading-relaxed">
                          {ans.content}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {answerAuthorInfo?.userName?.[0] || ans.author[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {answerAuthorInfo?.userName || ans.author.slice(0, 6) + '...' + ans.author.slice(-4)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ans.author.slice(0, 6)}...
                                {ans.author.slice(-4)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                              <Calendar className="h-3 w-3" />
                              {new Date(
                                Number(ans.createdAt)
                              ).toLocaleDateString()}
                            </div>
                          </div>

                          {isConnected &&
                            address &&
                            address.toLowerCase() ===
                              question.author.toLowerCase() &&
                            !ans.isAccepted && (
                              <Button
                                size="sm"
                                onClick={() => handleAcceptAnswer(ans.id)}
                                disabled={isLoading}
                              >
                                답변 채택 ({Number(question.reward) / 1e18} WAK)
                              </Button>
                            )}
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>

            {/* 답변 작성 */}
            <Card className="p-6 shadow-sm">
              <div className="space-y-1 mb-4">
                <h3 className="text-xl font-semibold">답변 작성하기</h3>
                <p className="text-sm text-muted-foreground">
                  💡마크다운 문법을 지원합니다
                </p>
              </div>

              {!isConnected ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mt-0 mb-4">
                    답변을 작성하려면 지갑을 연결해주세요.
                  </p>
                  <Button onClick={() => router.push('/')}>
                    지갑 연결하기
                  </Button>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="답변을 입력하세요..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="min-h-[200px] mb-4"
                  />

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={!answer.trim() || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          등록 중...
                        </>
                      ) : (
                        '답변 등록'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-20 space-y-6">
              {/* 관련 질문 */}
              <Card className="p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">관련 질문</h3>
                </div>
                <div className="space-y-3">
                  {relatedQuestions.map((q) => (
                    <Link
                      key={q.id}
                      href={`/question/${q.id}`}
                      className="block p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-medium mb-2 line-clamp-2">
                        {q.title}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {q.answers}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          <Coins className="h-3 w-3" />
                          {q.reward}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              {/* 인기 태그 */}
              <Card className="p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">인기 태그</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <Badge
                      key={tag.name}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {tag.name}
                      <span className="ml-1 text-xs opacity-60">
                        {tag.count}
                      </span>
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* 질문하기 CTA */}
              <Card className="p-6 shadow-sm shrink-0 from-primary/5 to-primary/10">
                <h3 className="font-semibold mb-2">질문이 있으신가요?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  전문가들에게 질문하고 실질적인 보상을 받으세요.
                </p>
                <Button className="w-full" asChild>
                  <Link href="/ask">질문하기</Link>
                </Button>
              </Card>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  )
}
