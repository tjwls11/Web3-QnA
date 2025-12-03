import { useState, useCallback } from 'react'
import { uploadToIPFS, downloadFromIPFS } from '@/lib/ipfs'
import * as storage from '@/lib/storage'
import type { Question, Answer } from '@/lib/contracts/types'

export function useContract() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const registerUser = useCallback(
    async (userName: string): Promise<boolean> => {
      return false
    },
    []
  )

  // 사용자 등록 여부 확인 (MongoDB)
  const isUserRegistered = useCallback(
    async (address: string): Promise<boolean> => {
      try {
        return await storage.isUserRegistered(address)
      } catch (err) {
        console.error('사용자 등록 확인 실패:', err)
        return false
      }
    },
    []
  )

  // 질문 작성
  const createQuestion = useCallback(
    async (
      title: string,
      content: string,
      reward: bigint,
      tags: string[],
      author: string,
      githubUrl?: string
    ): Promise<bigint | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 스마트 컨트랙트에 질문 등록 (토큰 approve + escrow 포함)
        const { createQuestionWithReward } = await import(
          '@/lib/web3/contract-functions'
        )

        // 질문 내용을 해시로 변환 (title + content 조합)
        const contentForHash = `${title}:${content}`
        const contentHash = contentForHash

        // 컨트랙트에 질문 등록 (토큰이 자동으로 escrow됨)
        const questionId = await createQuestionWithReward(
          title,
          contentHash,
          reward,
          tags
        )

        // MongoDB에도 저장 (UI 표시용)
        const question: Question & { content: string } = {
          id: questionId,
          author,
          title,
          contentHash,
          content,
          reward,
          tags,
          createdAt: BigInt(Date.now()),
          status: 'open',
          answerCount: BigInt(0),
          githubUrl: githubUrl || undefined,
        }
        await storage.saveQuestion(question)

        return questionId
      } catch (err: any) {
        console.error('질문 작성 실패:', err)
        setError(err.message || '질문 작성에 실패했습니다.')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 질문 조회
  const getQuestion = useCallback(
    async (
      questionId: bigint
    ): Promise<(Question & { content: string }) | null> => {
      try {
        const question = await storage.getQuestionById(questionId.toString())
        return question
      } catch (err) {
        console.error('질문 조회 실패:', err)
        return null
      }
    },
    []
  )

  // 답변 작성
  const createAnswer = useCallback(
    async (
      questionId: bigint,
      content: string,
      author: string
    ): Promise<bigint | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const answerId = BigInt(Date.now())
        const answer: Answer & { content: string } = {
          id: answerId,
          questionId,
          author,
          contentHash: '',
          content,
          createdAt: BigInt(Date.now()),
          isAccepted: false,
        }
        storage.saveAnswer(answer)

        // 질문의 답변 수 업데이트 (MongoDB API 호출)
        const question = await storage.getQuestionById(questionId.toString())
        if (question) {
          const updateResponse = await fetch('/api/questions', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: questionId.toString(),
              answerCount: Number(question.answerCount) + 1,
            }),
          })

          if (!updateResponse.ok) {
            console.error('답변 수 업데이트 실패')
          }
        }

        return answerId
      } catch (err: any) {
        console.error('답변 작성 실패:', err)
        setError(err.message || '답변 작성에 실패했습니다.')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 답변 채택
  const acceptAnswer = useCallback(
    async (questionId: bigint, answerId: bigint): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        // 스마트 컨트랙트에서 답변 채택 (토큰이 자동으로 분배됨)
        const { acceptAnswer: acceptAnswerContract } = await import(
          '@/lib/web3/contract-functions'
        )
        await acceptAnswerContract(questionId, answerId)

        // MongoDB에서도 답변 상태 업데이트
        const answers = storage.getAnswers()
        const answerIndex = answers.findIndex(
          (a) => a.id.toString() === answerId.toString()
        )
        if (answerIndex !== -1) {
          answers[answerIndex].isAccepted = true
          localStorage.setItem('qna_answers', JSON.stringify(answers))
        }

        // 질문 상태도 업데이트
        const question = await storage.getQuestionById(questionId.toString())
        if (question) {
          await fetch('/api/questions', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: questionId.toString(),
              status: 'solved',
            }),
          })
        }

        return true
      } catch (err: any) {
        console.error('답변 채택 실패:', err)
        setError(err.message || '답변 채택에 실패했습니다.')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 찜하기 추가
  const addBookmark = useCallback(
    async (questionId: bigint, userAddress: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await storage.addBookmark(questionId.toString(), userAddress)
        return true
      } catch (err: any) {
        console.error('찜하기 추가 실패:', err)
        setError(err.message || '찜하기 추가에 실패했습니다.')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 찜하기 제거
  const removeBookmark = useCallback(
    async (questionId: bigint, userAddress: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await storage.removeBookmark(questionId.toString(), userAddress)
        return true
      } catch (err: any) {
        console.error('찜하기 제거 실패:', err)
        setError(err.message || '찜하기 제거에 실패했습니다.')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 찜하기 여부 확인
  const isBookmarked = useCallback(
    async (questionId: bigint, userAddress: string): Promise<boolean> => {
      try {
        return storage.isBookmarked(questionId.toString(), userAddress)
      } catch (err) {
        console.error('찜하기 확인 실패:', err)
        return false
      }
    },
    []
  )

  const getTokenBalance = useCallback(
    async (address: string): Promise<bigint> => {
      return BigInt(0)
    },
    []
  )

  return {
    isLoading,
    error,
    registerUser,
    isUserRegistered,
    createQuestion,
    getQuestion,
    createAnswer,
    acceptAnswer,
    addBookmark,
    removeBookmark,
    isBookmarked,
    getTokenBalance,
  }
}
