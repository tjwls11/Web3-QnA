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
  isAccepted: boolean
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

    const answer: AnswerDocument = {
      id: `${questionId}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      questionId: questionId.toString(),
      author: author.toLowerCase(),
      content,
      contentHash: contentHash || '',
      createdAt: new Date(),
      isAccepted: false,
    }

    await answersCollection.insertOne(answer)

    // 사용자의 답변 수 증가 및 레벨 업데이트
    const usersCollection = db.collection('users')
    const authUsersCollection = db.collection('authUsers')
    
    // users 컬렉션 업데이트
    await usersCollection.updateOne(
      { address: answer.author },
      { 
        $inc: { answerCount: 1 },
        $setOnInsert: {
          address: answer.author,
          userName: '',
          registeredAt: new Date(),
          questionCount: 0,
          answerCount: 1,
          acceptedAnswerCount: 0,
          reputation: 0,
        }
      },
      { upsert: true }
    )

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
        id: BigInt(0),
        questionId: BigInt(questionId),
        author: answer.author,
        contentHash: answer.contentHash || '',
        createdAt: BigInt(answer.createdAt.getTime()),
        isAccepted: false,
      },
    })
  } catch (error: any) {
    console.error('답변 생성 실패:', error)
    return NextResponse.json(
      { error: '답변 생성에 실패했습니다.' },
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
      const answers = await answersCollection
        .find({ questionId: questionId.toString() })
        .sort({ createdAt: -1 })
        .toArray()

      return NextResponse.json({
        answers: answers.map((a) => ({
          id: BigInt(0),
          questionId: BigInt(a.questionId),
          author: a.author,
          content: a.content,
          contentHash: a.contentHash || '',
          createdAt: BigInt(a.createdAt.getTime()),
          isAccepted: a.isAccepted,
        })),
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
          const question = await questionsCollection.findOne({
            id: a.questionId,
          })
          return {
            id: BigInt(0),
            questionId: BigInt(a.questionId),
            author: a.author,
            content: a.content,
            contentHash: a.contentHash || '',
            createdAt: BigInt(a.createdAt.getTime()),
            isAccepted: a.isAccepted,
            questionTitle: question?.title || '',
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

// 답변 채택
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { answerId, questionId } = body

    if (!answerId || !questionId) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const answersCollection = db.collection<AnswerDocument>('answers')
    const questionsCollection = db.collection('questions')

    // 답변을 채택 상태로 변경
    await answersCollection.updateOne(
      { id: answerId.toString() },
      { $set: { isAccepted: true } }
    )

    // 질문 상태를 'solved'로 변경
    await questionsCollection.updateOne(
      { id: questionId.toString() },
      { $set: { status: 'solved' } }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('답변 채택 실패:', error)
    return NextResponse.json(
      { error: '답변 채택에 실패했습니다.' },
      { status: 500 }
    )
  }
}


