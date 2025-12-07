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
  Github,
} from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/header'
import { MarkdownContent } from '@/components/markdown-content'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function QuestionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isConnected, address, userName, isAuthenticated, connectWallet } =
    useWallet()
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
  const [answerAuthors, setAnswerAuthors] = useState<
    Record<string, { userName: string; avatarUrl: string | null }>
  >({})
  const [questionAuthor, setQuestionAuthor] = useState<{
    userName: string
    avatarUrl: string | null
  } | null>(null)
  const [receipt, setReceipt] = useState<any | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)

  // 질문 작성자 정보 로드 함수
  const loadQuestionAuthor = async (authorAddress: string) => {
    try {
      const response = await fetch(
        `/api/users/by-wallet?walletAddress=${encodeURIComponent(
          authorAddress
        )}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setQuestionAuthor({
            userName:
              data.user.userName ||
              authorAddress.slice(0, 6) + '...' + authorAddress.slice(-4),
            avatarUrl: data.user.avatarUrl || null,
          })
        } else {
          setQuestionAuthor({
            userName:
              authorAddress.slice(0, 6) + '...' + authorAddress.slice(-4),
            avatarUrl: null,
          })
        }
      } else {
        setQuestionAuthor({
          userName: authorAddress.slice(0, 6) + '...' + authorAddress.slice(-4),
          avatarUrl: null,
        })
      }
    } catch (error) {
      console.error('질문 작성자 정보 로드 실패:', error)
      setQuestionAuthor({
        userName: authorAddress.slice(0, 6) + '...' + authorAddress.slice(-4),
        avatarUrl: null,
      })
    }
  }

  // 답변 작성자 정보 로드 함수
  const loadAnswerAuthors = async (answersList: any[]) => {
    const authorsInfo: Record<
      string,
      { userName: string; avatarUrl: string | null }
    > = {}
    await Promise.all(
      answersList.map(async (ans: any) => {
        try {
          const response = await fetch(
            `/api/users/by-wallet?walletAddress=${ans.author}`
          )
          if (response.ok) {
            const data = await response.json()
            if (data.user) {
              authorsInfo[ans.author.toLowerCase()] = {
                userName:
                  data.user.userName ||
                  ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
                avatarUrl: data.user.avatarUrl || null,
              }
            } else {
              authorsInfo[ans.author.toLowerCase()] = {
                userName: ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
                avatarUrl: null,
              }
            }
          } else {
            authorsInfo[ans.author.toLowerCase()] = {
              userName: ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
              avatarUrl: null,
            }
          }
        } catch (error) {
          console.error('답변 작성자 정보 로드 실패:', error)
          authorsInfo[ans.author.toLowerCase()] = {
            userName: ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
            avatarUrl: null,
          }
        }
      })
    )
    setAnswerAuthors(authorsInfo)
  }

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

          console.log(
            '[질문 상세] 질문 ID:',
            questionData.id.toString(),
            typeof questionData.id.toString()
          )
          console.log(
            '[질문 상세] 질문 answerCount:',
            questionData.answerCount.toString()
          )
          console.log('[질문 상세] 질문 status:', questionData.status)

          // 답변 로드 (MongoDB) - 질문 ID를 문자열로 전달
          const questionIdString = questionData.id.toString()
          console.log('[질문 상세] 답변 조회할 questionId:', questionIdString)

          const questionAnswers = await storage.getAnswersByQuestionId(
            questionIdString
          )
          console.log('[질문 상세] 로드된 답변 수:', questionAnswers.length)

          // 질문의 acceptedAnswerId 확인 (타입에 없어서 any로 캐스팅)
          const acceptedAnswerId =
            (questionData as any).acceptedAnswerId || null
          console.log('[질문 상세] 질문 정보:', {
            id: questionData.id.toString(),
            status: questionData.status,
            acceptedAnswerId: acceptedAnswerId,
          })

          // 답변 상세 로그
          questionAnswers.forEach((a, index) => {
            const isAccepted =
              a.isAccepted === true || a.id.toString() === acceptedAnswerId
            console.log(`[질문 상세] 답변 ${index + 1}:`, {
              id: a.id.toString(),
              isAccepted: a.isAccepted,
              acceptedAnswerId: acceptedAnswerId,
              최종채택여부: isAccepted ? '채택됨' : '미채택',
            })
          })

          const hasAcceptedAnswer = questionAnswers.some(
            (a) => a.isAccepted === true || a.id.toString() === acceptedAnswerId
          )
          console.log('[질문 상세] 채택된 답변 있음:', hasAcceptedAnswer)

          // 채택된 답변이 있거나 질문에 acceptedAnswerId가 있으면 상태를 solved로 설정
          if (
            (hasAcceptedAnswer || acceptedAnswerId) &&
            questionData.status !== 'solved'
          ) {
            console.log(
              '[질문 상세] 채택된 답변이 있으므로 상태를 solved로 업데이트'
            )
            setQuestion({
              ...questionData,
              status: 'solved',
              acceptedAnswerId: acceptedAnswerId,
            })
          } else {
            setQuestion({ ...questionData, acceptedAnswerId: acceptedAnswerId })
          }

          setAnswers(questionAnswers)

          // 질문 작성자 정보 로드
          await loadQuestionAuthor(questionData.author)

          // 답변 작성자 정보 로드
          await loadAnswerAuthors(questionAnswers)

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
    if (!isAuthenticated) {
      alert('답변을 작성하려면 로그인이 필요합니다.')
      router.push('/')
      return
    }
    if (!isConnected || !address) {
      // 로그인 유도 메시지
      const shouldConnect = window.confirm(
        '답변을 작성하려면 지갑을 연결해야 합니다. 지갑을 연결하시겠습니까?'
      )
      if (shouldConnect) {
        try {
          await connectWallet()
        } catch (error) {
          console.error('지갑 연결 실패:', error)
        }
      }
      return
    }
    if (!answer.trim()) {
      alert('답변 내용을 입력해주세요.')
      return
    }
    if (!question) return

    try {
      const questionId = BigInt(question.id.toString())
      const answerId = await createAnswer(questionId, answer, address)

      if (answerId) {
        alert('답변이 등록되었습니다!')
        setAnswer('')

        // 답변 목록 새로고침 (MongoDB)
        const questionAnswers = await storage.getAnswersByQuestionId(
          question.id.toString()
        )
        setAnswers(questionAnswers)

        // 답변 작성자 정보 새로고침
        await loadAnswerAuthors(questionAnswers)

        // 질문의 답변 수 업데이트
        const updatedQuestion = await getQuestion(questionId)
        if (updatedQuestion) {
          setQuestion(updatedQuestion)
        }
      }
    } catch (error: any) {
      console.error('[질문 상세] 답변 작성 실패:', error)
      console.error('[질문 상세] 에러 상세:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      const errorMessage = error.message || '답변 작성에 실패했습니다.'
      alert(`답변 작성 실패: ${errorMessage}`)
    }
  }

  const handleAcceptAnswer = async (answerId: bigint) => {
    if (!isConnected || !address || !question) return

    if (address.toLowerCase() !== question.author.toLowerCase()) {
      alert('질문 작성자만 답변을 채택할 수 있습니다.')
      return
    }

    // 이미 채택된 답변이 있는지 확인
    const hasAcceptedAnswer = answers.some((ans) => ans.isAccepted)
    if (hasAcceptedAnswer) {
      alert(
        '이미 채택된 답변이 있습니다. 한 질문에는 하나의 답변만 채택할 수 있습니다.'
      )
      return
    }

    // 질문이 이미 해결된 상태인지 확인
    if (question.status === 'solved') {
      alert('이 질문은 이미 해결되었습니다.')
      return
    }

    try {
      const questionId = BigInt(question.id.toString())
      const result = await acceptAnswer(questionId, answerId)
      if (result?.success) {
        const rewardAmount = Number(question.reward) / 1e18
        alert(
          `답변이 채택되었습니다! ${rewardAmount} WAK 토큰이 답변자에게 전송됩니다.`
        )

        // 즉시 상태 업데이트 (UI 반영)
        setQuestion({ ...question, status: 'solved' })

        // 답변 목록 새로고침 (MongoDB)
        const questionAnswers = await storage.getAnswersByQuestionId(
          question.id.toString()
        )
        console.log(
          '[채택 후] 답변 목록:',
          questionAnswers.map((a) => ({
            id: a.id.toString(),
            isAccepted: a.isAccepted,
          }))
        )

        // 채택된 답변의 isAccepted를 true로 설정
        const updatedAnswers = questionAnswers.map((a) =>
          a.id.toString() === answerId.toString()
            ? { ...a, isAccepted: true }
            : a
        )
        setAnswers(updatedAnswers)

        // 답변 작성자 정보 새로고침
        await loadAnswerAuthors(updatedAnswers)

        // 질문 상태 업데이트 (서버에서 최신 상태 가져오기)
        setTimeout(async () => {
          const updatedQuestion = await getQuestion(questionId)
          if (updatedQuestion) {
            setQuestion(updatedQuestion)
            // 답변 목록도 다시 로드
            const freshAnswers = await storage.getAnswersByQuestionId(
              question.id.toString()
            )
            setAnswers(freshAnswers)
            await loadAnswerAuthors(freshAnswers)
          }
        }, 500)

        // 4단계: txHash 기반 영수증 조회 및 화면에 보이기
        try {
          if (result.txHash) {
            const res = await fetch(
              `/api/receipt?txHash=${encodeURIComponent(
                result.txHash
              )}&questionId=${encodeURIComponent(
                question.id.toString()
              )}&answerId=${encodeURIComponent(
                (result.contractAnswerId || answerId).toString()
              )}`
            )
            if (res.ok) {
              const data = await res.json()
              if (data.receipt) {
                setReceipt(data.receipt)
                setIsReceiptModalOpen(true)
              }
            } else {
              console.warn(
                '[질문 상세] 영수증 API 응답 오류:',
                res.status,
                res.statusText
              )
            }
          }
        } catch (receiptError) {
          console.warn(
            '[질문 상세] 영수증 조회 실패 (계속 진행):',
            receiptError
          )
        }
      }
    } catch (error: any) {
      console.error('답변 채택 실패:', error)
      // "Already resolved" 에러는 이미 사전 체크했으므로 다른 에러만 표시
      if (error.message?.includes('이미 해결되었습니다')) {
        // 질문 상태를 업데이트하여 UI 반영
        setQuestion({ ...question, status: 'solved' })
        // 답변 목록 새로고침
        const questionAnswers = await storage.getAnswersByQuestionId(
          question.id.toString()
        )
        setAnswers(questionAnswers)
        await loadAnswerAuthors(questionAnswers)
      } else {
        alert(error.message || '답변 채택에 실패했습니다.')
      }
    }
  }

  const handleViewReceipt = async () => {
    if (!question) return
    if (!address) {
      alert('지갑을 연결한 후 다시 시도해주세요.')
      return
    }

    try {
      setIsLoadingReceipt(true)
      const res = await fetch(
        `/api/receipts?questionId=${encodeURIComponent(question.id.toString())}`
      )
      if (!res.ok) {
        console.warn('[질문 상세] /api/receipts 호출 실패:', {
          status: res.status,
          statusText: res.statusText,
        })
        alert('영수증을 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      const list: any[] = Array.isArray(data.receipts) ? data.receipts : []
      if (list.length === 0) {
        console.warn('[질문 상세] 이 질문에 대한 영수증이 없습니다.', {
          questionId: question.id.toString(),
          address: address?.toLowerCase() || null,
        })
        alert('이 질문에 대한 영수증이 없습니다.')
        return
      }

      const lower = address.toLowerCase()
      const mine =
        list.find(
          (r) => r.questionAuthor === lower || r.answerAuthor === lower
        ) || list[0]

      setReceipt(mine)
      setIsReceiptModalOpen(true)
    } catch (err) {
      console.error('[질문 상세] 영수증 조회 실패:', err)
      alert('영수증을 불러오지 못했습니다.')
    } finally {
      setIsLoadingReceipt(false)
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
                  <div className="flex items-center gap-3 mb-4">
                    <h1 className="text-3xl font-bold text-balance">
                      {question.title}
                    </h1>
                    {(() => {
                      const acceptedAnswerId = question.acceptedAnswerId || null
                      const hasAcceptedAnswer = answers.some(
                        (ans) =>
                          ans.isAccepted === true ||
                          ans.id.toString() === acceptedAnswerId
                      )
                      const isQuestionSolved = question.status === 'solved'
                      const isSolved =
                        isQuestionSolved ||
                        hasAcceptedAnswer ||
                        !!acceptedAnswerId

                      const lowerAddr = address?.toLowerCase()
                      const acceptedAnswer =
                        answers.find(
                          (ans) =>
                            ans.isAccepted === true ||
                            ans.id.toString() === acceptedAnswerId
                        ) || null
                      const isQuestionAuthor =
                        lowerAddr && question.author.toLowerCase() === lowerAddr
                      const isAnswerAuthor =
                        lowerAddr &&
                        acceptedAnswer &&
                        acceptedAnswer.author.toLowerCase() === lowerAddr

                      return (
                        <div className="flex flex-col items-end gap-2">
                          {isSolved && (
                            <Badge
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Award className="h-3 w-3 mr-1" />
                              해결됨
                            </Badge>
                          )}
                          {isSolved && (isQuestionAuthor || isAnswerAuthor) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleViewReceipt}
                              disabled={isLoadingReceipt}
                            >
                              {isLoadingReceipt ? '로딩중...' : '영수증 보기'}
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
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

              <div className="mb-6 space-y-3">
                <MarkdownContent content={question.content} />
                {question.githubUrl && question.githubUrl !== '' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Github className="h-4 w-4" />
                    <a
                      href={question.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {question.githubUrl}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/user/${question.author}`}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={questionAuthor?.avatarUrl || undefined}
                      />
                      <AvatarFallback>
                        {questionAuthor?.userName?.[0]?.toUpperCase() ||
                          question.author[0]?.toUpperCase() ||
                          '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {questionAuthor?.userName ||
                          question.author.slice(0, 6) +
                            '...' +
                            question.author.slice(-4)}
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
                  answers.map((ans, index) => {
                    const authorInfo = answerAuthors[
                      ans.author.toLowerCase()
                    ] || {
                      userName:
                        ans.author.slice(0, 6) + '...' + ans.author.slice(-4),
                      avatarUrl: null,
                    }
                    const acceptedAnswerId = question.acceptedAnswerId || null
                    const isThisAnswerAccepted =
                      ans.isAccepted === true ||
                      ans.id.toString() === acceptedAnswerId
                    // 고유한 key 생성: id + questionId + index 조합
                    const uniqueKey = `${ans.id.toString()}_${ans.questionId.toString()}_${index}`
                    return (
                      <Card key={uniqueKey} className="p-6 shadow-sm">
                        {isThisAnswerAccepted && (
                          <div className="flex items-center gap-2 text-green-600 mb-4 bg-green-50 dark:bg-green-950 p-2 rounded">
                            <Award className="h-5 w-5" />
                            <span className="text-sm font-semibold">
                              채택된 답변
                            </span>
                          </div>
                        )}

                        <MarkdownContent
                          content={ans.content}
                          className="mb-4"
                        />

                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={authorInfo.avatarUrl || undefined}
                              />
                              <AvatarFallback>
                                {authorInfo.userName?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {authorInfo.userName}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(
                                    Number(ans.createdAt)
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {(() => {
                            const acceptedAnswerId =
                              question.acceptedAnswerId || null
                            const isQuestionAuthor =
                              isConnected &&
                              address &&
                              address.toLowerCase() ===
                                question.author.toLowerCase()
                            const hasAcceptedAnswer = answers.some(
                              (a) =>
                                a.isAccepted === true ||
                                a.id.toString() === acceptedAnswerId
                            )
                            const isQuestionSolved =
                              question.status === 'solved'
                            const isThisAnswerAccepted =
                              ans.isAccepted === true ||
                              ans.id.toString() === acceptedAnswerId
                            const canAccept =
                              isQuestionAuthor &&
                              !isThisAnswerAccepted &&
                              !isQuestionSolved &&
                              !hasAcceptedAnswer &&
                              !acceptedAnswerId

                            console.log('[UI] 답변 채택 버튼 체크:', {
                              isQuestionAuthor,
                              acceptedAnswerId: acceptedAnswerId,
                              answers: answers.map((a) => ({
                                id: a.id.toString(),
                                isAccepted: a.isAccepted,
                                matchesAcceptedId:
                                  a.id.toString() === acceptedAnswerId,
                              })),
                              hasAcceptedAnswer,
                              isQuestionSolved,
                              isThisAnswerAccepted,
                              canAccept,
                              answerId: ans.id.toString(),
                            })

                            if (canAccept) {
                              return (
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptAnswer(ans.id)}
                                  disabled={isLoading}
                                >
                                  답변 채택 ({Number(question.reward) / 1e18}{' '}
                                  WAK)
                                </Button>
                              )
                            } else if (isThisAnswerAccepted) {
                              return (
                                <Badge
                                  variant="default"
                                  className="bg-green-600 text-white"
                                >
                                  <Award className="h-3 w-3 mr-1" />
                                  채택됨
                                </Badge>
                              )
                            } else if (
                              (isQuestionSolved || hasAcceptedAnswer) &&
                              !isThisAnswerAccepted
                            ) {
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-muted-foreground"
                                >
                                  다른 답변이 채택됨
                                </Badge>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>

            {/* 답변 작성 */}
            <Card className="p-6 shadow-sm">
              {(() => {
                const acceptedAnswerId = question.acceptedAnswerId || null
                const hasAcceptedAnswer = answers.some(
                  (a) =>
                    a.isAccepted === true ||
                    a.id.toString() === acceptedAnswerId
                )
                const isQuestionSolved = question.status === 'solved'
                const isResolved =
                  hasAcceptedAnswer || isQuestionSolved || !!acceptedAnswerId

                console.log('[UI] 답변 작성 섹션 체크:', {
                  status: question.status,
                  acceptedAnswerId: acceptedAnswerId,
                  answers: answers.map((a) => ({
                    id: a.id.toString(),
                    isAccepted: a.isAccepted,
                    matchesAcceptedId: a.id.toString() === acceptedAnswerId,
                  })),
                  hasAcceptedAnswer,
                  isQuestionSolved,
                  isResolved,
                })

                if (isResolved) {
                  return (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Award className="h-5 w-5 text-green-600" />
                        <h3 className="text-xl font-semibold text-green-600">
                          이미 채택된 질문입니다
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        이 질문은 이미 해결되었습니다. 새로운 답변을 작성할 수
                        없습니다.
                      </p>
                    </div>
                  )
                }

                return (
                  <>
                    {!isAuthenticated ? (
                      <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground mt-0 mb-4">
                          답변을 작성하려면 로그인이 필요합니다.
                        </p>
                        <Button onClick={() => router.push('/')}>
                          로그인하기
                        </Button>
                      </div>
                    ) : !isConnected ? (
                      <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground mt-0 mb-4">
                          답변을 작성하려면 지갑을 연결해주세요.
                        </p>
                        <Button
                          onClick={async () => {
                            try {
                              await connectWallet()
                            } catch (error) {
                              console.error('지갑 연결 실패:', error)
                            }
                          }}
                        >
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
                  </>
                )
              })()}
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

      {/* 🔽🔽 추가: 영수증 모달 UI */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>온체인 영수증</DialogTitle>
            <DialogDescription>
              채택 트랜잭션을 기반으로 생성된 영수증입니다.
            </DialogDescription>
          </DialogHeader>

          {isLoadingReceipt ? (
            <div className="flex items-center justify-center py-6 space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>영수증을 불러오는 중입니다...</span>
            </div>
          ) : receipt ? (
            <div className="space-y-3 text-sm">
              {receipt.questionId && (
                <div>
                  <span className="font-medium mr-2">질문 ID:</span>
                  <span>{receipt.questionId}</span>
                </div>
              )}
              {receipt.answerId && (
                <div>
                  <span className="font-medium mr-2">답변 ID:</span>
                  <span>{receipt.answerId}</span>
                </div>
              )}
              {receipt.role && (
                <div>
                  <span className="font-medium mr-2">역할:</span>
                  <span>
                    {receipt.role === 'questioner'
                      ? '질문자'
                      : receipt.role === 'answerer'
                      ? '답변자'
                      : receipt.role}
                  </span>
                </div>
              )}
              {receipt.reward || receipt.rewardNormalized ? (
                <div>
                  <span className="font-medium mr-2">보상:</span>
                  <span>
                    {(
                      receipt.rewardNormalized ??
                      Number(receipt.reward ?? 0) / 1e18
                    ).toFixed(4)}{' '}
                    {receipt.tokenSymbol ?? 'WAK'}
                  </span>
                </div>
              ) : null}
              {receipt.txHash && (
                <div>
                  <span className="font-medium mr-2">TX Hash:</span>
                  <span className="font-mono break-all">{receipt.txHash}</span>
                </div>
              )}
              {receipt.blockNumber != null && (
                <div>
                  <span className="font-medium mr-2">블록 번호:</span>
                  <span>{receipt.blockNumber}</span>
                </div>
              )}

              {/* 원본 JSON 디버깅용 */}
              <details className="mt-3 rounded border px-3 py-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  원본 JSON 보기
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto text-[11px]">
                  {JSON.stringify(receipt, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              영수증 데이터를 불러오지 못했습니다.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReceiptModalOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
