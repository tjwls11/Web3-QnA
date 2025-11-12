"use client"

import type React from "react"

import { useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Coins, Search, TrendingUp, Eye, Heart } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet-context"
import { WalletRequiredModal } from "@/components/wallet-required-modal"

const popularQuestions = [
  {
    id: 1,
    title: "React에서 useEffect와 useLayoutEffect의 차이점은?",
    author: "개발자123",
    tags: ["React", "Hooks"],
    reward: 50,
    views: 2450,
    answers: 12,
  },
  {
    id: 2,
    title: "TypeScript 제네릭 타입 추론 문제",
    author: "TS고수",
    tags: ["TypeScript", "Generic"],
    reward: 100,
    views: 1890,
    answers: 8,
  },
  {
    id: 3,
    title: "Next.js 15 App Router 동적 라우팅",
    author: "프론트개발자",
    tags: ["Next.js", "React"],
    reward: 75,
    views: 1650,
    answers: 15,
  },
  {
    id: 4,
    title: "Web3.js vs Ethers.js 비교",
    author: "블록체인초보",
    tags: ["Blockchain", "Web3"],
    reward: 150,
    views: 1420,
    answers: 6,
  },
  {
    id: 5,
    title: "Django JWT 인증 구현 방법",
    author: "백엔드개발자",
    tags: ["Python", "Django"],
    reward: 80,
    views: 1280,
    answers: 10,
  },
]

const questions = [
  {
    id: 1,
    title: "React에서 useEffect와 useLayoutEffect의 차이점은?",
    content:
      "useEffect와 useLayoutEffect의 실행 타이밍과 사용 시나리오에 대해 궁금합니다. 실제 프로젝트에서 어떻게 활용하면 좋을까요?",
    author: "개발자123",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["React", "Hooks", "JavaScript"],
    reward: 50,
    answers: 3,
    views: 245,
    timestamp: "2시간 전",
    status: "open",
  },
  {
    id: 2,
    title: "TypeScript에서 제네릭 타입 추론이 안될 때 해결 방법",
    content: "제네릭 함수를 만들었는데 타입 추론이 제대로 동작하지 않습니다. 어떻게 해결할 수 있을까요?",
    author: "TS고수",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["TypeScript", "Generic", "Type"],
    reward: 100,
    answers: 7,
    views: 512,
    timestamp: "5시간 전",
    status: "answered",
  },
  {
    id: 3,
    title: "Next.js 15 App Router에서 동적 라우트를 어떻게 구현하는지 알고 싶습니다.",
    content: "Next.js 15의 App Router를 사용할 때 동적 라우트를 어떻게 구현하는지 알고 싶습니다.",
    author: "프론트개발자",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["Next.js", "React", "Routing"],
    reward: 75,
    answers: 12,
    views: 892,
    timestamp: "1일 전",
    status: "solved",
  },
  {
    id: 4,
    title: "Web3.js vs Ethers.js 어떤 라이브러리를 선택해야 할까요?",
    content: "블록체인 개발을 시작하려고 하는데 Web3.js와 Ethers.js 중 어떤 것이 더 나을까요?",
    author: "블록체인초보",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["Blockchain", "Web3", "Ethereum"],
    reward: 150,
    answers: 5,
    views: 367,
    timestamp: "3시간 전",
    status: "open",
  },
  {
    id: 5,
    title: "Python Django REST Framework에서 JWT 인증 구현",
    content: "DRF에서 JWT 토큰 기반 인증을 구현하려고 합니다. 베스트 프랙티스가 무엇인가요?",
    author: "백엔드개발자",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["Python", "Django", "JWT", "Authentication"],
    reward: 80,
    answers: 8,
    views: 634,
    timestamp: "6시간 전",
    status: "answered",
  },
  {
    id: 6,
    title: "Docker Compose로 마이크로서비스 환경 구축하기",
    content: "여러 서비스를 Docker Compose로 관리하려고 하는데 네트워크 설정이 복잡합니다.",
    author: "DevOps엔지니어",
    authorAvatar: "/placeholder.svg?height=40&width=40",
    tags: ["Docker", "DevOps", "Microservices"],
    reward: 120,
    answers: 4,
    views: 289,
    timestamp: "7시간 전",
    status: "open",
  },
]

export default function HomePage() {
  const { isConnected } = useWallet()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<number[]>([])
  const [filter, setFilter] = useState<"latest" | "unanswered">("latest")

  const handleBookmark = (questionId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isConnected) {
      setShowWalletModal(true)
      return
    }

    setBookmarkedQuestions((prev) => {
      if (prev.includes(questionId)) {
        return prev.filter((id) => id !== questionId)
      }
      return [...prev, questionId]
    })
  }

  const filteredQuestions = filter === "unanswered" ? questions.filter((q) => q.status === "open") : questions

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {showWalletModal && <WalletRequiredModal onClose={() => setShowWalletModal(false)} />}

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            많이 본 Q&A
          </h2>
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {popularQuestions.map((question) => (
                <Link key={question.id} href={`/question/${question.id}`} className="snap-start">
                  <Card className="w-[280px] flex-shrink-0 h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 leading-tight min-h-[2.5rem]">
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
                            <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <Coins className="h-4 w-4" />
                          <span>{question.reward}</span>
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
            <Input placeholder="궁금한 것을 검색해보세요" className="h-12 pl-10 text-base" />
          </div>

          <div className="flex gap-2">
            <Button variant={filter === "latest" ? "default" : "outline"} size="sm" onClick={() => setFilter("latest")}>
              최근순
            </Button>
            <Button
              variant={filter === "unanswered" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unanswered")}
            >
              미답변
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <main>
            <div className="space-y-4">
              {filteredQuestions.map((question) => (
                <Link key={question.id} href={`/question/${question.id}`}>
                  <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={question.authorAvatar || "/placeholder.svg"} />
                          <AvatarFallback>{question.author[0]}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-1">
                            <h3 className="font-semibold text-base hover:text-primary transition-colors">
                              {question.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => handleBookmark(question.id, e)}
                              >
                                <Heart
                                  className={`h-4 w-4 ${bookmarkedQuestions.includes(question.id) ? "fill-primary text-primary" : ""}`}
                                />
                              </Button>
                              <div className="flex items-center gap-1 text-primary font-bold">
                                <Coins className="h-4 w-4" />
                                <span className="text-sm">{question.reward}</span>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{question.content}</p>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{question.author}</span>
                            <span>•</span>
                            <span>{question.timestamp}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {question.answers}
                            </span>
                            <span>•</span>
                            <span>조회 {question.views}</span>
                            {bookmarkedQuestions.includes(question.id) && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-primary">
                                  <Heart className="h-3 w-3 fill-primary" />
                                  저도 궁금해요
                                </span>
                              </>
                            )}
                            <div className="flex gap-1 ml-auto">
                              {question.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
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
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((page) => (
                <Button key={page} variant={page === 1 ? "default" : "outline"} size="sm">
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
                  "React",
                  "TypeScript",
                  "Next.js",
                  "Python",
                  "Blockchain",
                  "JavaScript",
                  "Node.js",
                  "Web3",
                  "Docker",
                  "AWS",
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
                <CardTitle className="text-base font-bold">이번 주 상위 기여자</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "전문가A", tokens: 450, avatar: "/placeholder.svg?height=32&width=32" },
                    { name: "개발고수B", tokens: 380, avatar: "/placeholder.svg?height=32&width=32" },
                    { name: "코딩왕C", tokens: 320, avatar: "/placeholder.svg?height=32&width=32" },
                    { name: "프로그래머D", tokens: 280, avatar: "/placeholder.svg?height=32&width=32" },
                    { name: "시니어E", tokens: 245, avatar: "/placeholder.svg?height=32&width=32" },
                  ].map((user, index) => (
                    <div
                      key={user.name}
                      className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-base font-bold w-6 ${index < 3 ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {index + 1}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar || "/placeholder.svg"} />
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

            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">지식을 공유하고 보상받으세요</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-primary-foreground/90 mb-4 leading-relaxed">
                  전문 지식으로 다른 개발자를 도와주고 실질적인 토큰 보상을 받으세요.
                </p>
                <Button variant="secondary" className="w-full font-semibold" asChild>
                  <Link href="/ask">질문하기</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
