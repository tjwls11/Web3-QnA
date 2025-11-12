"use client"

import type React from "react"

import { useState } from "react"
import { Header } from "@/components/header"
import { ProtectedPage } from "@/components/protected-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { X, Plus, HelpCircle, Coins } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AskPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState("")
  const [reward, setReward] = useState([50])

  const handleAddTag = () => {
    if (currentTag && !tags.includes(currentTag) && tags.length < 5) {
      setTags([...tags, currentTag])
      setCurrentTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 질문 등록 로직
    alert("질문이 등록되었습니다!")
    router.push("/")
  }

  const suggestedTags = ["React", "TypeScript", "Next.js", "JavaScript", "Python", "Blockchain", "Node.js", "Web3"]

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold">질문하기</h1>
              <p className="text-muted-foreground">명확하고 구체적인 질문을 작성하면 더 좋은 답변을 받을 수 있습니다</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
              {/* 질문 작성 폼 */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 제목 */}
                <Card>
                  <CardHeader>
                    <CardTitle>질문 제목</CardTitle>
                    <CardDescription>문제를 간단명료하게 요약해주세요</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      placeholder="예: React에서 useEffect와 useLayoutEffect의 차이점은?"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="text-base"
                    />
                  </CardContent>
                </Card>

                {/* 내용 */}
                <Card>
                  <CardHeader>
                    <CardTitle>질문 내용</CardTitle>
                    <CardDescription>문제 상황, 시도한 방법, 기대하는 결과를 자세히 설명해주세요</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="질문 내용을 작성하세요...&#10;&#10;- 현재 상황&#10;- 시도한 방법&#10;- 오류 메시지 (있다면)&#10;- 기대하는 결과"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      rows={12}
                      className="text-base font-mono"
                    />
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <HelpCircle className="h-4 w-4" />
                      <span>마크다운 문법을 지원합니다</span>
                    </div>
                  </CardContent>
                </Card>

                {/* 태그 */}
                <Card>
                  <CardHeader>
                    <CardTitle>태그</CardTitle>
                    <CardDescription>질문과 관련된 기술 스택을 선택하세요 (최대 5개)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="태그 입력..."
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                        disabled={tags.length >= 5}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddTag}
                        disabled={!currentTag || tags.length >= 5}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* 선택된 태그 */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 rounded-sm hover:bg-secondary-foreground/20"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* 추천 태그 */}
                    <div>
                      <Label className="mb-2 text-xs text-muted-foreground">추천 태그</Label>
                      <div className="flex flex-wrap gap-2">
                        {suggestedTags
                          .filter((tag) => !tags.includes(tag))
                          .map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                if (tags.length < 5) {
                                  setTags([...tags, tag])
                                }
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 보상 설정 */}
                <Card>
                  <CardHeader>
                    <CardTitle>보상 설정</CardTitle>
                    <CardDescription>답변자에게 제공할 토큰 보상을 설정하세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">{reward[0]} AK</span>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>현재 잔액: 1,250 AK</p>
                      </div>
                    </div>
                    <Slider value={reward} onValueChange={setReward} min={10} max={500} step={10} className="w-full" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10</span>
                      <span>250</span>
                      <span>500</span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                      <p className="text-muted-foreground">💡 높은 보상은 더 빠르고 질 높은 답변을 받을 수 있습니다</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 제출 버튼 */}
                <div className="flex gap-3">
                  <Button type="submit" size="lg" className="flex-1">
                    질문 등록하기
                  </Button>
                  <Button type="button" size="lg" variant="outline" onClick={() => router.push("/")}>
                    취소
                  </Button>
                </div>
              </form>

              {/* 사이드바 - 작성 가이드 */}
              <aside className="space-y-6">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-base">좋은 질문 작성 팁</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <h4 className="mb-2 font-semibold">1. 명확한 제목</h4>
                      <p className="text-muted-foreground">질문의 핵심을 한 문장으로 요약하세요</p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">2. 구체적인 설명</h4>
                      <p className="text-muted-foreground">문제 상황과 기대하는 결과를 명확히 작성하세요</p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">3. 코드 첨부</h4>
                      <p className="text-muted-foreground">관련 코드를 마크다운 코드 블록으로 첨부하세요</p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">4. 적절한 태그</h4>
                      <p className="text-muted-foreground">관련 기술 스택 태그를 정확히 선택하세요</p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">5. 적정 보상</h4>
                      <p className="text-muted-foreground">질문의 난이도에 맞는 보상을 설정하세요</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base">알아두세요</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <p>• 답변 채택 시 설정한 토큰이 자동 전송됩니다</p>
                    <p>• 질문 등록 후 수정이 가능합니다</p>
                    <p>• 부적절한 질문은 관리자에 의해 삭제될 수 있습니다</p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  )
}
