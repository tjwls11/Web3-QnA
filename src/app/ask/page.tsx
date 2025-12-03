'use client'

import type React from 'react'

import { useState } from 'react'
import { Header } from '@/components/header'
import { ProtectedPage } from '@/components/protected-page'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  X,
  Plus,
  HelpCircle,
  Coins,
  Loader2,
  Github,
  Link as LinkIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet-context'
import { useContract } from '@/hooks/useContract'

export default function AskPage() {
  const router = useRouter()
  const { address, isAuthenticated, isConnected, connectWallet, tokenBalance } =
    useWallet()
  const { createQuestion, isLoading, error } = useContract()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState('')
  const [reward, setReward] = useState([5])
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleAddTag = () => {
    if (currentTag && !tags.includes(currentTag) && tags.length < 5) {
      setTags([...tags, currentTag])
      setCurrentTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    console.log('질문 등록 시도:', {
      address,
      isAuthenticated,
      isConnected,
      title,
      content,
    })

    if (!isAuthenticated) {
      setSubmitError('로그인이 필요합니다.')
      return
    }

    if (!isConnected || !address) {
      setSubmitError('지갑을 연결해주세요.')
      try {
        await connectWallet()
      } catch (err) {
        console.error('지갑 연결 실패:', err)
      }
      return
    }

    if (!title.trim() || !content.trim()) {
      setSubmitError('제목과 내용을 입력해주세요.')
      return
    }

    // 토큰 잔액 확인
    const rewardAmount = reward[0]
    if (tokenBalance < rewardAmount) {
      setSubmitError(
        `토큰 잔액이 부족합니다. 현재 잔액: ${tokenBalance.toFixed(
          2
        )} WAK, 필요: ${rewardAmount} WAK`
      )
      return
    }

    try {
      // reward를 wei 단위로 변환 (18 decimals)
      const rewardInWei = BigInt(rewardAmount * 1e18)

      const questionId = await createQuestion(
        title.trim(),
        content.trim(),
        rewardInWei,
        tags,
        address,
        githubUrl.trim() || undefined
      )

      if (questionId) {
        // 성공 메시지와 함께 질문 상세 페이지로 이동
        router.push(`/question/${questionId}`)
      } else {
        setSubmitError(error || '질문 등록에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('질문 등록 실패:', err)
      setSubmitError(err.message || '질문 등록에 실패했습니다.')
    }
  }

  const suggestedTags = [
    'React',
    'TypeScript',
    'Next.js',
    'JavaScript',
    'Python',
    'Blockchain',
    'Node.js',
    'Web3',
  ]

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="w-full py-8">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold">질문하기</h1>
            </div>

            <div className="w-full">
              {/* 질문 작성 폼 */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 제목 */}
                <Card>
                  <CardHeader>
                    <CardTitle>질문 제목</CardTitle>
                    <CardDescription>
                      문제를 간단명료하게 요약해주세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      placeholder="질문 제목을 입력하세요"
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
                    <CardDescription>
                      문제 상황, 시도한 방법, 기대하는 결과를 자세히
                      설명해주세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="질문 내용을 작성하세요 (마크다운 지원)"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      rows={12}
                      className="text-base"
                    />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <HelpCircle className="h-4 w-4" />
                      <span>
                        마크다운 문법을 지원합니다 (예: **굵게**, `코드`,
                        ```코드 블록```)
                      </span>
                    </div>

                    {/* 깃허브 링크 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        깃허브 링크 (선택사항)
                      </Label>
                      <Input
                        type="url"
                        placeholder="https://github.com/username/repository"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="text-base"
                      />
                      <p className="text-xs text-muted-foreground">
                        코드 관련 질문인 경우 깃허브 저장소 링크를 추가해주세요
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 태그 */}
                <Card>
                  <CardHeader>
                    <CardTitle>태그</CardTitle>
                    <CardDescription>
                      질문과 관련된 기술 스택을 선택하세요 (최대 5개)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="태그 입력..."
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
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
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
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
                      <Label className="mb-2 text-xs text-muted-foreground">
                        추천 태그
                      </Label>
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
                    <CardDescription>
                      답변자에게 제공할 토큰 보상을 설정하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                          {reward[0]} WAK
                        </span>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>보상: {reward[0]} WAK</p>
                        <p className="text-xs">
                          잔액: {tokenBalance.toFixed(2)} WAK
                        </p>
                      </div>
                    </div>
                    {tokenBalance < reward[0] && (
                      <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                        <p className="font-semibold">
                          ⚠️ 토큰 잔액이 부족합니다
                        </p>
                        <p className="text-xs mt-1">
                          현재 잔액: {tokenBalance.toFixed(2)} WAK, 필요:{' '}
                          {reward[0]} WAK
                        </p>
                        <p className="text-xs mt-1">
                          마이페이지에서 ETH를 WAK으로 환전하세요.
                        </p>
                      </div>
                    )}
                    <Slider
                      value={reward}
                      onValueChange={setReward}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                      <p className="text-muted-foreground">
                        💡 높은 보상은 더 빠르고 질 높은 답변을 받을 수 있습니다
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 제출 버튼 */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      '질문 등록하기'
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => router.push('/')}
                    disabled={isLoading}
                  >
                    취소
                  </Button>
                </div>
                {(error || submitError) && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                    {submitError || error}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  )
}
