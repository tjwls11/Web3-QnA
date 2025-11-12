"use client"

import { Header } from "@/components/header"
import { ProtectedPage } from "@/components/protected-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet-context"
import { useState, useEffect } from "react"

export default function MyPage() {
  const { userName, setUserName, tokenBalance, subtractTokens, address } = useWallet()
  const [isEditNameOpen, setIsEditNameOpen] = useState(false)
  const [newName, setNewName] = useState("")

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")

  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false)
  const [interestTags, setInterestTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const availableTags = [
    "React",
    "TypeScript",
    "Next.js",
    "Blockchain",
    "Python",
    "Django",
    "JavaScript",
    "Node.js",
    "Web3",
    "Smart Contract",
    "Solidity",
    "Vue.js",
    "Angular",
    "Java",
    "Spring",
    "Rust",
    "Go",
    "C++",
    "Security",
  ]

  useEffect(() => {
    const savedTags = localStorage.getItem("interestTags")
    if (savedTags) {
      setInterestTags(JSON.parse(savedTags))
    } else {
      setInterestTags(["React", "TypeScript", "Next.js", "Blockchain"])
    }
  }, [])

  useEffect(() => {
    if (interestTags.length > 0) {
      localStorage.setItem("interestTags", JSON.stringify(interestTags))
    }
  }, [interestTags])

  const handleNameChange = () => {
    if (newName.trim()) {
      setUserName(newName.trim())
      setIsEditNameOpen(false)
      setNewName("")
    }
  }

  const handleWithdraw = async () => {
    setWithdrawError("")
    const amount = Number.parseFloat(withdrawAmount)

    if (!amount || amount <= 0) {
      setWithdrawError("출금 금액을 입력해주세요")
      return
    }

    if (amount < 10) {
      setWithdrawError("최소 출금 금액은 10 AK입니다")
      return
    }

    if (amount > tokenBalance) {
      setWithdrawError("잔액이 부족합니다")
      return
    }

    setIsWithdrawing(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      subtractTokens(amount)

      alert(`${amount} AK를 성공적으로 출금했습니다!\n지갑 주소: ${address?.slice(0, 6)}...${address?.slice(-4)}`)
      setIsWithdrawOpen(false)
      setWithdrawAmount("")
    } catch (error) {
      console.error("출금 실패:", error)
      setWithdrawError("출금에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsWithdrawing(false)
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
      setNewTag("")
    }
  }

  const myQuestions = [
    {
      id: 1,
      title: "React에서 useEffect와 useLayoutEffect의 차이점은?",
      status: "open",
      answers: 3,
      views: 245,
      reward: 50,
      date: "2시간 전",
    },
    {
      id: 2,
      title: "Next.js에서 API Routes 보안 처리 방법",
      status: "solved",
      answers: 8,
      views: 512,
      reward: 75,
      date: "1일 전",
    },
  ]

  const bookmarkedQuestions = [
    {
      id: 1,
      title: "TypeScript 제네릭 타입 추론이 안될 때 해결 방법",
      status: "answered",
      answers: 7,
      views: 512,
      reward: 100,
      date: "5시간 전",
    },
    {
      id: 4,
      title: "Web3.js vs Ethers.js 어떤 라이브러리를 선택해야 할까요?",
      status: "open",
      answers: 5,
      views: 367,
      reward: 150,
      date: "3시간 전",
    },
  ]

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
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="/developer-working.png" />
                    <AvatarFallback className="text-2xl">{userName?.[0] || "개"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <h1 className="text-2xl font-bold">{userName || "개발자123"}</h1>
                      <Badge variant="secondary">Level 5</Badge>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">0x1234...5678</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">React 전문가</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">Top 10%</Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditNameOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  프로필 수정
                </Button>
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
                    <span className="text-3xl font-bold">{tokenBalance.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">AK</span>
                  </div>
                  <Button className="w-full" size="sm" onClick={() => setIsWithdrawOpen(true)}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    토큰 출금
                  </Button>
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
                    <span className="font-semibold">23</span>
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
                    <span className="font-medium">Level 5</span>
                    <span className="text-muted-foreground">Level 6</span>
                  </div>
                  <Progress value={65} className="mb-2" />
                  <p className="text-xs text-muted-foreground">350점 더 필요 (650/1000)</p>
                </CardContent>
              </Card>

              {/* 관심 태그 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">관심 태그</CardTitle>
                  <CardDescription>알림을 받을 태그를 설정하세요</CardDescription>
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
                  {myQuestions.map((question) => (
                    <Card key={question.id}>
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
                                {question.answers}개 답변
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {question.views}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {question.date}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1">
                              <Coins className="h-4 w-4 text-primary" />
                              <span className="font-bold text-primary">{question.reward}</span>
                            </div>
                            <Badge variant={question.status === "solved" ? "default" : "outline"}>
                              {question.status === "solved" ? "해결됨" : "진행중"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </TabsContent>

                {/* 내 답변 탭 */}
                <TabsContent value="answers" className="space-y-4">
                  {[
                    {
                      question: "TypeScript에서 제네릭 타입 추론이 안될 때",
                      status: "accepted",
                      reward: 100,
                      date: "5시간 전",
                    },
                    {
                      question: "Python Django REST Framework JWT 인증",
                      status: "pending",
                      reward: 80,
                      date: "1일 전",
                    },
                  ].map((answer, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardDescription className="mb-2">답변한 질문</CardDescription>
                            <CardTitle className="mb-2 text-lg hover:text-primary cursor-pointer">
                              {answer.question}
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {answer.date}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1">
                              <Coins className="h-4 w-4 text-primary" />
                              <span className="font-bold text-primary">+{answer.reward}</span>
                            </div>
                            <Badge variant={answer.status === "accepted" ? "default" : "secondary"}>
                              {answer.status === "accepted" ? "채택됨 ✓" : "대기중"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </TabsContent>

                {/* 보상 내역 탭 */}
                <TabsContent value="rewards" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>총 획득 토큰</CardTitle>
                      <CardDescription>전체 기간 동안 획득한 토큰</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 text-4xl font-bold text-primary">2,450 AK</div>
                      <div className="space-y-3">
                        {[
                          { type: "답변 채택", amount: 100, date: "2024.11.10", tx: "0xabc...123" },
                          { type: "답변 채택", amount: 75, date: "2024.11.09", tx: "0xdef...456" },
                          { type: "답변 채택", amount: 150, date: "2024.11.08", tx: "0xghi...789" },
                        ].map((reward, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-lg border border-border p-4"
                          >
                            <div>
                              <p className="font-medium">{reward.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {reward.date} • TX: {reward.tx}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">+{reward.amount} AK</p>
                            </div>
                          </div>
                        ))}
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
                        {[
                          {
                            type: "답변 작성",
                            content: "TypeScript 제네릭 타입 추론에 답변했습니다",
                            time: "2시간 전",
                          },
                          { type: "질문 작성", content: "React useEffect 관련 질문을 등록했습니다", time: "5시간 전" },
                          { type: "답변 채택", content: "작성한 답변이 채택되었습니다 (+100 AK)", time: "1일 전" },
                          { type: "태그 추가", content: "Blockchain 태그를 관심 태그로 추가했습니다", time: "2일 전" },
                        ].map((activity, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{activity.type}</p>
                              <p className="text-sm text-muted-foreground">{activity.content}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bookmarks" className="space-y-4">
                  {bookmarkedQuestions.map((question, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="h-4 w-4 fill-primary text-primary" />
                              <CardDescription>저도 궁금해요</CardDescription>
                            </div>
                            <CardTitle className="mb-2 text-lg hover:text-primary cursor-pointer">
                              <Link href={`/question/${question.id}`}>{question.title}</Link>
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                {question.answers}개 답변
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {question.views}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {question.date}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1">
                              <Coins className="h-4 w-4 text-primary" />
                              <span className="font-bold text-primary">{question.reward}</span>
                            </div>
                            <Badge variant={question.status === "answered" ? "default" : "outline"}>
                              {question.status === "answered" ? "답변됨" : "진행중"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
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
              <DialogDescription>새로운 닉네임을 입력해주세요.</DialogDescription>
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
                    if (e.key === "Enter") {
                      handleNameChange()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditNameOpen(false)}>
                취소
              </Button>
              <Button onClick={handleNameChange}>변경</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isTagManagementOpen} onOpenChange={setIsTagManagementOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>관심 태그 관리</DialogTitle>
              <DialogDescription>
                관심있는 태그를 선택하면 관련 질문이 올라올 때 알림을 받을 수 있습니다.
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
                    <span className="text-sm text-muted-foreground">선택된 태그가 없습니다</span>
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
                      if (e.key === "Enter") {
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
                      variant={interestTags.includes(tag) ? "default" : "outline"}
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
              <Button onClick={() => setIsTagManagementOpen(false)}>완료</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 출금 모달 */}
        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>토큰 출금</DialogTitle>
              <DialogDescription>
                출금할 토큰을 메타마스크 지갑으로 전송합니다. 가스비가 발생할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Current Balance */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-1">현재 잔액</p>
                <p className="text-2xl font-bold">{tokenBalance.toLocaleString()} AK</p>
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
                      setWithdrawError("")
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
                <p className="text-xs text-muted-foreground">최소 출금 금액: 10 AK</p>
                {withdrawError && <p className="text-sm text-destructive">{withdrawError}</p>}
              </div>

              {/* Wallet Address */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">받는 지갑 주소</p>
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
                  setWithdrawAmount("")
                  setWithdrawError("")
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
      </div>
    </ProtectedPage>
  )
}
