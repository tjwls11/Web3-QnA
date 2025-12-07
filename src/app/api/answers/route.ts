import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { Answer } from '@/lib/contracts/types'

interface AnswerDocument {
  id: string
  questionId: string
  author: string
  content: string
  contentHash?: string
  createdAt: Date
  isAccepted?: boolean
}

// 답변 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, author, content, contentHash } = body

    if (!questionId || !author || !content) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const answersCollection = db.collection<AnswerDocument>('answers')
    const questionsCollection = db.collection('questions')

    // questionId를 문자열로 정규화 (질문 ID와 정확히 일치하도록)
    const normalizedQuestionId = questionId.toString()

    // 질문이 이미 해결되었는지 확인
    const question = await questionsCollection.findOne({
      id: normalizedQuestionId,
    })
    if (question) {
      if (question.status === 'solved' || question.acceptedAnswerId) {
        return NextResponse.json(
          { error: '이미 해결된 질문에는 답변을 작성할 수 없습니다.' },
          { status: 400 }
        )
      }
    }

    console.log('[답변 생성] 요청 데이터:', {
      questionId: normalizedQuestionId,
      author: author.toLowerCase(),
      contentLength: content.length,
    })

    const answer: AnswerDocument = {
      id: `${normalizedQuestionId}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`,
      questionId: normalizedQuestionId, // 질문 ID와 정확히 일치하도록 문자열로 저장
      author: author.toLowerCase(),
      content,
      contentHash: contentHash || '',
      createdAt: new Date(),
      isAccepted: false,
    }

    console.log('[답변 생성] 저장할 답변 데이터:', {
      id: answer.id,
      questionId: answer.questionId,
      author: answer.author,
      contentLength: answer.content.length,
    })

    // MongoDB에 답변 저장
    let insertResult
    try {
      insertResult = await answersCollection.insertOne(answer)
      console.log('[답변 생성] 답변 저장 완료:', {
        insertedId: insertResult.insertedId,
        answerId: answer.id,
        questionId: answer.questionId,
      })
    } catch (insertError: any) {
      console.error('[답변 생성] insertOne 실패:', insertError)
      throw new Error(`답변 저장 실패: ${insertError.message}`)
    }

    // 저장 확인: 방금 저장한 답변을 다시 조회해서 확인 (선택적)
    try {
      const savedAnswer = await answersCollection.findOne({ id: answer.id })
      if (!savedAnswer) {
        console.warn(
          '[답변 생성] 저장 확인: 답변을 찾을 수 없습니다. 하지만 insertOne은 성공했습니다.'
        )
        // insertOne이 성공했으면 계속 진행 (타이밍 이슈일 수 있음)
      } else {
        console.log('[답변 생성] 저장 확인 성공:', savedAnswer.id)
      }
    } catch (verifyError: any) {
      console.warn(
        '[답변 생성] 저장 확인 중 에러 (무시하고 계속 진행):',
        verifyError.message
      )
      // 저장 확인 실패해도 insertOne이 성공했으면 계속 진행
    }

    // 질문의 답변 수 증가 (중요!)
    const questionUpdateResult = await questionsCollection.updateOne(
      { id: normalizedQuestionId },
      { $inc: { answerCount: 1 } }
    )
    console.log('[답변 생성] 질문 answerCount 업데이트:', {
      matchedCount: questionUpdateResult.matchedCount,
      modifiedCount: questionUpdateResult.modifiedCount,
      questionId: normalizedQuestionId,
    })

    if (questionUpdateResult.matchedCount === 0) {
      console.warn(
        '[답변 생성] 질문을 찾을 수 없습니다. questionId:',
        normalizedQuestionId
      )
    }

    // 사용자의 답변 수 증가 및 레벨 업데이트
    const usersCollection = db.collection('users')
    const authUsersCollection = db.collection('authUsers')

    // users 컬렉션 업데이트
    // 먼저 사용자가 존재하는지 확인
    const existingUser = await usersCollection.findOne({
      address: answer.author,
    })
    if (existingUser) {
      // 사용자가 있으면 answerCount만 증가
      await usersCollection.updateOne(
        { address: answer.author },
        { $inc: { answerCount: 1 } }
      )
    } else {
      // 사용자가 없으면 새로 생성 (answerCount는 1로 시작)
      await usersCollection.insertOne({
        address: answer.author,
        userName: '',
        registeredAt: new Date(),
        questionCount: 0,
        answerCount: 1,
        acceptedAnswerCount: 0,
        reputation: 0,
      })
    }

    // authUsers 컬렉션도 업데이트 (지갑 주소가 있는 경우)
    const user = await authUsersCollection.findOne({
      walletAddress: answer.author,
    })
    if (user) {
      const newAnswerCount = (user.answerCount || 0) + 1
      await authUsersCollection.updateOne(
        { walletAddress: answer.author },
        { $set: { answerCount: newAnswerCount } }
      )
    }

    return NextResponse.json({
      answer: {
        id: answer.id, // 실제 생성된 ID 반환
        questionId: normalizedQuestionId,
        author: answer.author,
        contentHash: answer.contentHash || '',
        createdAt: answer.createdAt.getTime().toString(),
        isAccepted: false,
      },
    })
  } catch (error: any) {
    console.error('[답변 생성] 실패:', error)
    console.error('[답변 생성] 에러 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })

    const errorMessage = error.message || '답변 생성에 실패했습니다.'
    const errorDetails =
      process.env.NODE_ENV === 'development'
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    )
  }
}

// 답변 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')
    const author = searchParams.get('author')

    const client = await clientPromise
    const db = client.db('wakqna')
    const answersCollection = db.collection<AnswerDocument>('answers')

    if (questionId) {
      // 특정 질문의 답변 조회
      const normalizedQuestionId = questionId.toString()
      console.log(
        '[답변 조회] 요청 questionId:',
        normalizedQuestionId,
        typeof normalizedQuestionId
      )

      // DB에 저장된 모든 답변의 questionId 확인 (디버깅용)
      const allAnswers = await answersCollection.find({}).toArray()
      console.log('[답변 조회] ========== 디버깅 정보 ==========')
      console.log(
        '[답변 조회] 요청 questionId:',
        normalizedQuestionId,
        '타입:',
        typeof normalizedQuestionId
      )
      console.log('[답변 조회] DB의 모든 답변 개수:', allAnswers.length, '개')

      if (allAnswers.length > 0) {
        console.log('[답변 조회] DB의 모든 답변 상세:')
        allAnswers.forEach((a, index) => {
          console.log(
            `  [${index + 1}] id: ${a.id}, questionId: "${
              a.questionId
            }" (타입: ${typeof a.questionId}), author: ${a.author}`
          )
          console.log(
            `      매칭 여부: ${
              a.questionId === normalizedQuestionId ? '일치' : '불일치'
            }`
          )
        })
      } else {
        console.log('[답변 조회] DB에 답변이 하나도 없습니다.')
      }

      // 질문도 확인
      const questionsCollection = db.collection('questions')
      const questionDoc = await questionsCollection.findOne({
        id: normalizedQuestionId,
      })
      if (questionDoc) {
        console.log('[답변 조회] 질문 정보:', {
          id: questionDoc.id,
          answerCount: questionDoc.answerCount,
          acceptedAnswerId: questionDoc.acceptedAnswerId,
        })
      } else {
        console.log(
          '[답변 조회] 질문을 찾을 수 없습니다. questionId:',
          normalizedQuestionId
        )
      }

      const answers = await answersCollection
        .find({ questionId: normalizedQuestionId })
        .sort({ createdAt: -1 })
        .toArray()

      console.log('[답변 조회] 매칭된 답변 수:', answers.length)
      if (answers.length > 0) {
        console.log('[답변 조회] 매칭된 답변 데이터:')
        answers.forEach((a, index) => {
          console.log(
            `  [${index + 1}] id: ${a.id}, questionId: "${
              a.questionId
            }", author: ${a.author}, isAccepted: ${a.isAccepted}`
          )
        })
      }
      console.log('[답변 조회] 디버깅 로그 종료')

      // 질문 정보에서 채택된 답변 ID 가져오기
      const acceptedAnswerId = questionDoc?.acceptedAnswerId || null
      console.log('[답변 조회] 질문의 채택된 답변 ID:', acceptedAnswerId)

      const mappedAnswers = answers.map((a) => {
        // 질문 테이블의 acceptedAnswerId와 비교하거나 답변의 isAccepted 확인
        const isAccepted = a.id === acceptedAnswerId || a.isAccepted === true

        const statusText = isAccepted ? '채택됨' : '미채택'
        console.log(`[답변 조회] 답변 ${a.id}: ${statusText}`, {
          answerId: a.id,
          acceptedAnswerId: acceptedAnswerId,
          isAccepted: a.isAccepted,
          finalIsAccepted: isAccepted,
        })

        return {
          id: a.id || `${a.questionId}_${a.createdAt.getTime()}`,
          questionId: a.questionId.toString(),
          author: a.author,
          content: a.content,
          contentHash: a.contentHash || '',
          createdAt: a.createdAt.getTime().toString(),
          isAccepted: isAccepted,
        }
      })

      return NextResponse.json({
        answers: mappedAnswers,
      })
    } else if (author) {
      // 특정 작성자의 답변 조회
      const answers = await answersCollection
        .find({ author: author.toLowerCase() })
        .sort({ createdAt: -1 })
        .toArray()

      // 질문 정보도 함께 가져오기
      const questionsCollection = db.collection('questions')
      const answersWithQuestions = await Promise.all(
        answers.map(async (a) => {
          const questionDoc = await questionsCollection.findOne({
            id: a.questionId,
          })

          // 답변 ID를 BigInt로 변환 시도
          let answerId = BigInt(0)
          if (a.id) {
            try {
              if (typeof a.id === 'string' && /^\d+$/.test(a.id)) {
                answerId = BigInt(a.id)
              } else if (typeof a.id === 'number') {
                answerId = BigInt(a.id)
              } else {
                // 복합 ID인 경우 타임스탬프 부분 추출
                const parts = a.id.split('_')
                if (parts.length > 1 && parts[parts.length - 1]) {
                  const timestamp = parseInt(parts[parts.length - 1], 10)
                  if (!isNaN(timestamp)) {
                    answerId = BigInt(timestamp)
                  }
                }
              }
            } catch (e) {
              console.warn('[답변 조회] ID 변환 실패:', a.id, e)
              answerId = BigInt(a.createdAt.getTime())
            }
          } else {
            // ID가 없으면 생성 시간을 사용
            answerId = BigInt(a.createdAt.getTime())
          }

          return {
            id: answerId.toString(),
            questionId: (a.questionId || '').toString(),
            author: a.author,
            content: a.content,
            contentHash: a.contentHash || '',
            createdAt: a.createdAt.getTime().toString(),
            isAccepted: a.isAccepted || false,
            questionTitle: questionDoc?.title || '',
          }
        })
      )

      return NextResponse.json({
        answers: answersWithQuestions,
      })
    } else {
      return NextResponse.json(
        { error: 'questionId 또는 author 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('답변 조회 실패:', error)
    return NextResponse.json(
      { error: '답변 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 답변 채택 또는 업데이트
export async function PUT(request: NextRequest) {
  try {
    console.log('[답변 채택 API] 요청 받음')
    const body = await request.json()
    const { answerId, questionId, contentHash } = body
    console.log('[답변 채택 API] 요청 데이터:', {
      answerId,
      questionId,
      contentHash,
    })

    const client = await clientPromise
    const db = client.db('wakqna')
    const answersCollection = db.collection<AnswerDocument>('answers')
    const questionsCollection = db.collection('questions')

    // contentHash만 업데이트하는 경우
    if (contentHash && !questionId) {
      if (!answerId) {
        return NextResponse.json(
          { error: 'answerId가 필요합니다.' },
          { status: 400 }
        )
      }

      await answersCollection.updateOne(
        { id: answerId.toString() },
        { $set: { contentHash: contentHash } }
      )

      return NextResponse.json({ success: true })
    }

    // 답변 채택
    if (!answerId || !questionId) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    console.log('[답변 채택] 시작:', { answerId, questionId })

    const normalizedQuestionId = questionId.toString()
    const answerIdStr = answerId.toString()
    const idPrefix = `${normalizedQuestionId}_${answerIdStr}_`
    const regex = new RegExp(`^${idPrefix}`)

    let answerDoc = await answersCollection.findOne({
      questionId: normalizedQuestionId,
      id: { $regex: regex },
    })

    if (!answerDoc) {
      answerDoc = await answersCollection.findOne({
        id: answerIdStr,
        questionId: normalizedQuestionId,
      })
    }

    if (!answerDoc) {
      console.error('[답변 채택] 해당 답변을 찾을 수 없습니다.', {
        questionId: normalizedQuestionId,
        answerId: answerIdStr,
      })
      return NextResponse.json(
        { error: '답변을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updateData: any = { isAccepted: true }
    if (contentHash) {
      updateData.contentHash = contentHash
    }

    const answerUpdateResult = await answersCollection.updateOne(
      { _id: (answerDoc as any)._id },
      { $set: updateData }
    )

    console.log('[답변 채택] 답변 업데이트 결과:', {
      matchedCount: answerUpdateResult.matchedCount,
      modifiedCount: answerUpdateResult.modifiedCount,
      answerId: answerIdStr,
      dbId: answerDoc.id,
    })

    const updatedAnswer = await answersCollection.findOne({
      _id: (answerDoc as any)._id,
    })
    console.log('[답변 채택] 업데이트된 답변:', {
      id: updatedAnswer?.id,
      isAccepted: updatedAnswer?.isAccepted,
      questionId: updatedAnswer?.questionId,
    })

    // 질문 정보 가져오기 (보상 금액 확인용)
    const question = await questionsCollection.findOne({
      id: questionId.toString(),
    })
    if (!question) {
      return NextResponse.json(
        { error: '질문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // reward는 wei 단위로 저장되어 있을 수 있으므로 확인 후 변환
    let rewardAmount = 0
    if (question.reward) {
      const rewardValue = Number(question.reward)

      // reward가 1e18 이상이면 wei 단위로 간주하고 WAK으로 변환
      // 1 WAK = 1e18 wei이므로, 1보다 크면 wei 단위로 간주
      if (rewardValue >= 1e18) {
        rewardAmount = rewardValue / 1e18
        console.log(
          '[답변 채택] reward를 wei에서 WAK으로 변환:',
          rewardValue,
          'wei ->',
          rewardAmount,
          'WAK'
        )
      } else {
        // 이미 WAK 단위로 저장된 경우
        rewardAmount = rewardValue
        console.log('[답변 채택] reward가 이미 WAK 단위:', rewardAmount, 'WAK')
      }
    }
    console.log(
      '[답변 채택] 최종 보상 금액:',
      rewardAmount,
      'WAK (원본 reward:',
      question.reward,
      ')'
    )

    // 질문 상태를 'solved'로 변경하고 채택된 답변 ID 저장
    const questionUpdateResult = await questionsCollection.updateOne(
      { id: questionId.toString() },
      {
        $set: {
          status: 'solved',
          acceptedAnswerId: answerId.toString(),
        },
      }
    )

    console.log('[답변 채택] 질문 업데이트 결과:', {
      matchedCount: questionUpdateResult.matchedCount,
      modifiedCount: questionUpdateResult.modifiedCount,
      questionId: questionId.toString(),
      acceptedAnswerId: answerId.toString(),
    })

    const updatedQuestion = await questionsCollection.findOne({
      id: questionId.toString(),
    })
    console.log('[답변 채택] 업데이트된 질문:', {
      id: updatedQuestion?.id,
      status: updatedQuestion?.status,
      acceptedAnswerId: updatedQuestion?.acceptedAnswerId,
    })

    // 답변자에게 토큰 지급 (반드시 실행)
    console.log('[답변 채택] 토큰 지급 체크:', {
      rewardAmount,
      hasUpdatedAnswer: !!updatedAnswer,
      updatedAnswerAuthor: updatedAnswer?.author,
      willProceed: rewardAmount > 0 && !!updatedAnswer,
    })

    if (!updatedAnswer) {
      console.error(
        '[답변 채택] 업데이트된 답변을 찾을 수 없습니다. answerId:',
        answerId.toString()
      )
      return NextResponse.json(
        { error: '답변을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (rewardAmount > 0) {
      const answerAuthor = updatedAnswer.author.toLowerCase()
      console.log('[답변 채택] 답변자 지갑 주소:', answerAuthor)

      const authUsersCollection = db.collection('authUsers')
      const usersCollection = db.collection('users')

      // 답변자가 authUsers에 있는지 확인 (DB 기준 내부 포인트 잔액 사용)
      const answerer = await authUsersCollection.findOne({
        walletAddress: answerAuthor,
      })

      console.log('[답변 채택] 답변자 조회 결과 (DB 기준):', {
        answerAuthor,
        found: !!answerer,
        answererEmail: answerer?.email,
        answererTokenBalance: answerer?.tokenBalance,
      })

      if (answerer) {
        const existingBalance = answerer.tokenBalance || 0
        const finalBalance = existingBalance + rewardAmount

        const updateResult = await authUsersCollection.updateOne(
          { walletAddress: answerAuthor },
          {
            $set: { tokenBalance: finalBalance },
            $inc: { acceptedAnswerCount: 1 },
          }
        )

        console.log('[답변 채택] 답변자 토큰 잔액/채택 수 업데이트:', {
          답변자: answerAuthor,
          이전DB잔액: existingBalance,
          최종잔액: finalBalance,
          지급금액: rewardAmount,
          updateResult: {
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount,
          },
        })

        // users 컬렉션의 acceptedAnswerCount도 증가
        await usersCollection.updateOne(
          { address: answerAuthor },
          { $inc: { acceptedAnswerCount: 1 } },
          { upsert: true }
        )
      } else {
        console.warn(
          '[답변 채택] 답변자를 authUsers에서 찾을 수 없습니다 (DB 포인트 기준):',
          answerAuthor
        )
      }
    } else {
      console.warn('[답변 채택] 토큰 지급 조건 불만족 (rewardAmount <= 0):', {
        rewardAmount,
        hasUpdatedAnswer: !!updatedAnswer,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('답변 채택 실패:', error)
    return NextResponse.json(
      { error: '답변 채택에 실패했습니다.' },
      { status: 500 }
    )
  }
}
