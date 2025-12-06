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
        // 1. IPFS에 답변 내용 업로드하고 contentHash 생성
        const { uploadToIPFS } = await import('@/lib/ipfs')
        const contentHash = await uploadToIPFS({ content })
        console.log('[답변 작성] Content Hash:', contentHash)

        // 2. MongoDB에 답변 저장
        const response = await fetch('/api/answers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId: questionId.toString(),
            author: author.toLowerCase(),
            content: content,
            contentHash: contentHash,
          }),
        })

        if (!response.ok) {
          let errorData: any = {}
          try {
            const text = await response.text()
            console.error('[답변 생성] API 에러 응답 텍스트:', text)
            if (text) {
              errorData = JSON.parse(text)
            }
          } catch (parseError) {
            console.error('[답변 생성] 에러 응답 파싱 실패:', parseError)
            errorData = {
              error: `서버 오류 (${response.status} ${response.statusText})`,
            }
          }

          console.error('[답변 생성] API 에러 응답:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          })

          const errorMessage =
            errorData.error ||
            errorData.details ||
            errorData.message ||
            `답변 작성에 실패했습니다. (${response.status})`
          throw new Error(errorMessage)
        }

        const data = await response.json()
        const mongoAnswerId =
          data.answer?.id ||
          `${questionId}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}`

        // 3. 스마트 컨트랙트에 답변 등록 (선택사항 - MetaMask가 연결되어 있을 때만)
        let answerId: bigint
        try {
          const { createAnswerContract } = await import(
            '@/lib/web3/contract-functions'
          )
          const contractAnswerId = await createAnswerContract(
            questionId,
            contentHash
          )

          if (contractAnswerId === null) {
            // MetaMask가 없어서 null 반환된 경우
            console.warn(
              '[답변 작성] MetaMask가 없어 스마트 컨트랙트에 등록하지 않습니다. MongoDB에는 저장되었습니다.'
            )
            // MongoDB ID를 사용
            const idParts = mongoAnswerId.split('_')
            if (idParts.length >= 2 && /^\d+$/.test(idParts[1])) {
              answerId = BigInt(idParts[1]) // 타임스탬프 부분 사용
            } else {
              answerId = BigInt(Date.now())
            }
          } else {
            console.log(
              '[답변 작성] 스마트 컨트랙트 답변 ID:',
              contractAnswerId.toString()
            )
            // 스마트 컨트랙트의 답변 ID를 사용
            answerId = contractAnswerId
          }
        } catch (contractError: any) {
          console.warn(
            '[답변 작성] 스마트 컨트랙트 등록 실패 (계속 진행):',
            contractError.message
          )
          // 스마트 컨트랙트 등록 실패해도 MongoDB에는 저장됨
          // MetaMask가 없거나 연결되지 않은 경우 정상적인 동작

          // MongoDB에서 받은 ID를 사용 (fallback)
          // MongoDB ID는 문자열이므로 타임스탬프 기반 ID 생성
          try {
            // MongoDB ID에서 숫자 부분 추출 시도
            const idParts = mongoAnswerId.split('_')
            if (idParts.length >= 2 && /^\d+$/.test(idParts[1])) {
              answerId = BigInt(idParts[1]) // 타임스탬프 부분 사용
            } else {
              answerId = BigInt(Date.now())
            }
          } catch {
            answerId = BigInt(Date.now())
          }
        }

        // localStorage에도 저장 (캐시)
        const answer: Answer & { content: string } = {
          id: answerId,
          questionId,
          author,
          contentHash: contentHash,
          content,
          createdAt: BigInt(Date.now()),
          isAccepted: false,
        }
        storage.saveAnswer(answer)

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
      // 원래 답변 ID 저장 (MongoDB 업데이트용 및 온체인 ID로 사용)
      const originalAnswerId = answerId

      try {
        // 스마트 컨트랙트에서 답변 채택 (토큰이 자동으로 분배됨)
        // 이미 답변 작성 시 createAnswerContract로 온체인에 등록된 답변 ID를 사용해야 하며,
        // 채택 시점에는 그 온체인 ID를 조회해서 사용한다.
        const { acceptAnswer: acceptAnswerContract, findOnchainAnswerId } =
          await import('@/lib/web3/contract-functions')

        // 먼저 MongoDB에서 답변 정보 조회
        const answers = await storage.getAnswersByQuestionId(
          questionId.toString()
        )
        const answer = answers.find((a) => {
          // answerId가 BigInt인 경우와 문자열인 경우 모두 처리
          if (typeof a.id === 'bigint') {
            return a.id.toString() === answerId.toString()
          } else if (a.id !== null && a.id !== undefined) {
            try {
              const aId = BigInt(String(a.id))
              return aId.toString() === answerId.toString()
            } catch {
              return false
            }
          }
          return false
        })

        if (!answer) {
          throw new Error('답변을 찾을 수 없습니다.')
        }

        // contentHash가 없으면 IPFS에 업로드하고 생성
        let contentHash = answer.contentHash
        if (!contentHash || contentHash === '') {
          console.log(
            '[답변 채택] Content Hash가 없습니다. IPFS에 업로드합니다...'
          )
          const { uploadToIPFS } = await import('@/lib/ipfs')
          contentHash = await uploadToIPFS({ content: answer.content })

          // MongoDB에 contentHash 업데이트
          try {
            await fetch('/api/answers', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                answerId: originalAnswerId.toString(),
                contentHash: contentHash,
              }),
            })
          } catch (updateError) {
            console.warn(
              '[답변 채택] ContentHash 업데이트 실패 (계속 진행):',
              updateError
            )
          }
        }

        // 온체인에 등록된 답변 ID를 조회
        const contractAnswerId = await findOnchainAnswerId(
          questionId,
          answer.author,
          contentHash
        )

        if (contractAnswerId === null) {
          throw new Error(
            '이 답변은 블록체인에 등록되어 있지 않습니다. 답변 작성 시 지갑을 연결한 상태에서 작성한 답변만 토큰 보상을 받을 수 있습니다.'
          )
        }

        try {
          await acceptAnswerContract(questionId, contractAnswerId)
        } catch (err: any) {
          // "Answer not found" 에러는 그대로 사용자에게 전달
          if (
            err.reason === 'Answer not found' ||
            err.message?.includes('Answer not found')
          ) {
            throw new Error(
              '블록체인에서 해당 답변을 찾을 수 없습니다. 답변을 다시 작성하시거나, 나중에 다시 시도해주세요.'
            )
          }
          throw err
        }

        // MongoDB에서도 답변 상태 업데이트 (원래 답변 ID 사용)
        console.log('[답변 채택] MongoDB 업데이트 시작:', {
          answerId: originalAnswerId.toString(),
          questionId: questionId.toString(),
        })

        const answerUpdateResponse = await fetch('/api/answers', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answerId: originalAnswerId.toString(),
            questionId: questionId.toString(),
          }),
        })

        console.log('[답변 채택] MongoDB 업데이트 응답:', {
          status: answerUpdateResponse.status,
          statusText: answerUpdateResponse.statusText,
          ok: answerUpdateResponse.ok,
        })

        if (!answerUpdateResponse.ok) {
          // 응답 본문을 텍스트로 먼저 읽기
          const responseText = await answerUpdateResponse.text().catch(() => '')
          let errorData: any = {}
          try {
            if (responseText) {
              errorData = JSON.parse(responseText)
            }
          } catch (parseError) {
            errorData = { message: responseText || '알 수 없는 에러' }
          }

          // 치명적인 에러가 아니라 로그만 남기고 계속 진행 (스마트 컨트랙트는 이미 처리됨)
          console.warn(
            '[답변 채택] MongoDB 업데이트 비정상 응답 (무시하고 계속 진행):',
            {
              status: answerUpdateResponse.status,
              statusText: answerUpdateResponse.statusText,
              responseText: responseText,
              error: errorData,
              answerId: originalAnswerId.toString(),
              questionId: questionId.toString(),
            }
          )
        } else {
          const responseData = await answerUpdateResponse
            .json()
            .catch(() => ({}))
          console.log('[답변 채택] MongoDB 업데이트 성공:', responseData)
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
