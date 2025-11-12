"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/lib/wallet-context"
import { Heart, Calendar, MessageSquare, Coins, Award, TrendingUp, Tag } from "lucide-react"
import Link from "next/link"
import Header from "@/components/header"

export default function QuestionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isConnected, address, userName } = useWallet()
  const [answer, setAnswer] = useState("")
  const [isBookmarked, setIsBookmarked] = useState(false)

  const question = {
    id: params?.id,
    title: "React에서 useEffect의 의존성 배열은 어떻게 작동하나요?",
    content:
      "useEffect를 사용할 때 의존성 배열을 비워두면 한 번만 실행되는데, 특정 state를 넣으면 그 state가 변경될 때마다 실행됩니다. 이 원리가 정확히 어떻게 작동하는지 궁금합니다.\n\n예를 들어:\n```\nuseEffect(() => {\n  console.log('실행');\n}, [count]);\n```\n\n이런 식으로 작성하면 count가 변경될 때마다 실행되는 이유가 무엇인가요?",
    author: {
      name: "김개발",
      avatar: "/placeholder.svg?height=40&width=40",
      level: 5,
      address: "0x1234...5678",
    },
    reward: 50,
    tags: ["React", "JavaScript", "Hooks"],
    views: 234,
    answers: 3,
    createdAt: "2025-01-10",
    status: "open",
  }

  const answers = [
    {
      id: 1,
      content:
        "useEffect의 의존성 배열은 React가 컴포넌트를 리렌더링할 때마다 배열 내부의 값들을 이전 렌더링 때의 값과 비교합니다.\n\n예시 코드:\n```\nuseEffect(() => {\n  // effect 코드\n}, [dependency])\n```\n\n만약 값이 변경되었다면 effect를 다시 실행합니다. React는 Object.is() 비교 알고리즘을 사용하여 값의 변경을 감지합니다.",
      author: {
        name: "박전문가",
        avatar: "/placeholder.svg?height=40&width=40",
        level: 12,
        address: "0xabcd...efgh",
      },
      createdAt: "2025-01-10",
      isAccepted: false,
    },
    {
      id: 2,
      content:
        "빈 배열 []을 전달하면 컴포넌트가 마운트될 때 한 번만 실행됩니다.\n\n의존성 배열을 아예 생략하면 매 렌더링마다 실행됩니다.\n\n정리:\n- [] : 마운트 시 1회\n- [dependency] : dependency 변경 시\n- 생략 : 매 렌더링마다",
      author: {
        name: "이코더",
        avatar: "/placeholder.svg?height=40&width=40",
        level: 8,
        address: "0x9876...4321",
      },
      createdAt: "2025-01-11",
      isAccepted: false,
    },
  ]

  const relatedQuestions = [
    { id: 2, title: "useEffect cleanup 함수는 언제 사용하나요?", answers: 5, reward: 30 },
    { id: 3, title: "React 18의 새로운 기능은?", answers: 8, reward: 100 },
    { id: 4, title: "useState vs useReducer 차이점", answers: 12, reward: 45 },
  ]

  const popularTags = [
    { name: "React", count: 1234 },
    { name: "JavaScript", count: 2341 },
    { name: "TypeScript", count: 987 },
    { name: "Next.js", count: 654 },
    { name: "Node.js", count: 543 },
  ]

  const handleSubmitAnswer = () => {
    if (!isConnected) {
      alert("지갑을 연결해주세요.")
      return
    }
    if (!answer.trim()) return

    alert("답변이 등록되었습니다!")
    setAnswer("")
  }

  const handleAcceptAnswer = (answerId: number) => {
    if (!isConnected || address !== question.author.address) {
      alert("질문 작성자만 답변을 채택할 수 있습니다.")
      return
    }
    alert(`답변이 채택되었습니다! ${question.reward} AK 토큰이 답변자에게 전송됩니다.`)
  }

  const handleBookmark = () => {
    if (!isConnected) {
      alert("지갑을 연결해주세요.")
      return
    }
    setIsBookmarked(!isBookmarked)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 max-w-4xl">
            {/* 질문 카드 */}
            <Card className="p-8 mb-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-4 text-balance">{question.title}</h1>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {question.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="px-3 py-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant={isBookmarked ? "default" : "outline"} size="sm" onClick={handleBookmark}>
                  <Heart className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
                </Button>
              </div>

              <div className="mb-6 whitespace-pre-wrap text-sm leading-relaxed">{question.content}</div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <Link href="/my-page" className="flex items-center gap-2 hover:opacity-80">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={question.author.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{question.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{question.author.name}</p>
                      <p className="text-xs text-muted-foreground">Level {question.author.level}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {question.createdAt}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    {question.answers}
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-primary">
                    <Coins className="h-4 w-4" />
                    {question.reward} AK
                  </div>
                </div>
              </div>
            </Card>

            {/* 답변 목록 */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-6">{answers.length}개의 답변</h2>
              <div className="space-y-4">
                {answers.map((ans) => (
                  <Card key={ans.id} className="p-6 shadow-sm">
                    {ans.isAccepted && (
                      <div className="flex items-center gap-2 text-green-600 mb-4 bg-green-50 dark:bg-green-950 p-2 rounded">
                        <Award className="h-5 w-5" />
                        <span className="text-sm font-semibold">채택된 답변</span>
                      </div>
                    )}

                    <div className="mb-4 whitespace-pre-wrap text-sm leading-relaxed">{ans.content}</div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={ans.author.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{ans.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{ans.author.name}</p>
                          <p className="text-xs text-muted-foreground">Level {ans.author.level}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                          <Calendar className="h-3 w-3" />
                          {ans.createdAt}
                        </div>
                      </div>

                      {isConnected && address === question.author.address && !ans.isAccepted && (
                        <Button size="sm" onClick={() => handleAcceptAnswer(ans.id)}>
                          답변 채택 ({question.reward} AK)
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 답변 작성 */}
            <Card className="p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4">답변 작성하기</h3>
              {!isConnected ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground mb-4">답변을 작성하려면 지갑을 연결해주세요.</p>
                  <Button onClick={() => router.push("/")}>지갑 연결하기</Button>
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
                    <Button onClick={handleSubmitAnswer} disabled={!answer.trim()}>
                      답변 등록
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
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
                      <p className="text-sm font-medium mb-2 line-clamp-2">{q.title}</p>
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
                      <span className="ml-1 text-xs opacity-60">{tag.count}</span>
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* 질문하기 CTA */}
              <Card className="p-6 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
                <h3 className="font-semibold mb-2">질문이 있으신가요?</h3>
                <p className="text-sm text-muted-foreground mb-4">전문가들에게 질문하고 실질적인 보상을 받으세요.</p>
                <Button className="w-full" asChild>
                  <Link href="/ask">질문하기</Link>
                </Button>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
