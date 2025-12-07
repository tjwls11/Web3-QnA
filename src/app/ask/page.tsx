'use client'

import type React from 'react'

import { useState } from 'react'
import { Header } from '@/components/header'
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
import { X, Plus, Coins, Loader2, Github, Link as LinkIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet-context'
import { useContract } from '@/hooks/useContract'

export default function AskPage() {
  const router = useRouter()
  const { address, isAuthenticated, isConnected, connectWallet, tokenBalance } =
    useWallet()
  const { createQuestion, isLoading, error } = useContract()
  const [questionType, setQuestionType] = useState<'general' | 'code'>(
    'general'
  )
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState('')
  const [reward, setReward] = useState([5])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [codeFiles, setCodeFiles] = useState<File[]>([])

  const handleAddTag = () => {
    if (currentTag && !tags.includes(currentTag) && tags.length < 5) {
      setTags([...tags, currentTag])
      setCurrentTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleCodeFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setCodeFiles(files)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    console.log('질문 등록 시도:', {
      address,
      isAuthenticated,
      isConnected,
      title,
      questionType,
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

    if (!title.trim()) {
      setSubmitError('제목을 입력해주세요.')
      return
    }

    if (!content.trim()) {
      setSubmitError('질문 내용을 입력해주세요.')
      return
    }

    // 태그 필수 (두 타입 공통)
    if (tags.length === 0) {
      setSubmitError('태그를 최소 1개 이상 선택해주세요.')
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

      const finalContent = content.trim()
      const finalGithubUrl = githubUrl.trim() || undefined

      const questionId = await createQuestion(
        title.trim(),
        finalContent,
        rewardInWei,
        tags,
        address,
        finalGithubUrl
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
    <div className="min-h-screen bg-background">
      <Header />

      <div className="w-full py-8">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">질문하기</h1>
          </div>

          <div className="w-full">
            {/* 질문 타입 토글 */}
            <div className="mb-6">
              <Tabs
                value={questionType}
                onValueChange={(v) =>
                  setQuestionType((v as 'general' | 'code') || 'general')
                }
              >
                <TabsList>
                  <TabsTrigger value="general">일반 Q&amp;A</TabsTrigger>
                  <TabsTrigger value="code">코드 에러 질문</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 질문 작성 폼 */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 제목 */}
              <Card>
                <CardHeader>
                  <CardTitle>질문 제목</CardTitle>
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder={
                      questionType === 'code'
                        ? '에러가 나는 코드, 에러 메시지, 실행 환경 등을 한 번에 정리해서 작성해주세요.'
                        : '질문 내용을 작성하세요'
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={12}
                    className="text-base"
                  />

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
                      {questionType === 'code'
                        ? '프로젝트 전체 구조가 필요할 수 있을 때 참고용으로 사용합니다. 대용량일 경우 깃허브 링크를 사용해 주세요.'
                        : '설계 리뷰나 구조 설명이 필요할 때만 링크를 추가하면 됩니다.'}
                    </p>
                  </div>

                  {/* 코드 에러 질문 전용: 파일 업로드 (선택) */}
                  {questionType === 'code' && (
                    <div className="space-y-2 pt-2 border-t mt-4">
                      <Label className="text-sm font-medium">
                        코드 / 폴더 파일 업로드 (선택)
                      </Label>
                      <Input
                        type="file"
                        multiple
                        accept=".ts,.tsx,.js,.py,.sol,.json,.zip"
                        onChange={handleCodeFilesChange}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        .ts, .tsx, .js, .py, .sol, .json, .zip 형식만 업로드할
                        수 있습니다. 대용량 프로젝트는 깃허브 공개 저장소 링크로
                        공유해 주세요.
                      </p>
                      {codeFiles.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          선택된 파일: {codeFiles.map((f) => f.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
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
                      <p className="font-semibold">토큰 잔액이 부족합니다</p>
                      <p className="text-xs mt-1">
                        현재 잔액: {tokenBalance.toFixed(2)} WAK, 필요:{' '}
                        {reward[0]} WAK
                      </p>
                      <p className="text-xs mt-1">
                        마이페이지에서 ETH를 WAK 토큰으로 환전하세요.
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
                    <span>WAK</span>
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
  )
}
