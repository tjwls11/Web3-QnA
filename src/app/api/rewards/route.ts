import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

interface RewardDocument {
  userAddress: string
  type: string // 'answer_accepted', 'question_reward', etc.
  amount: number
  questionId?: string
  answerId?: string
  transactionHash?: string
  createdAt: Date
}

// 보상 내역 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const rewardsCollection = db.collection<RewardDocument>('rewards')

    const rewards = await rewardsCollection
      .find({ userAddress: userAddress.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      rewards: rewards.map((r) => ({
        type: r.type === 'answer_accepted' ? '답변 채택' : '질문 보상',
        amount: r.amount,
        date: r.createdAt.toLocaleDateString('ko-KR'),
        tx: r.transactionHash || undefined,
        createdAt: r.createdAt.getTime(),
      })),
    })
  } catch (error: any) {
    console.error('보상 내역 조회 실패:', error)
    return NextResponse.json(
      { error: '보상 내역 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 보상 추가 (내부용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, type, amount, questionId, answerId, transactionHash } = body

    if (!userAddress || !type || !amount) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const rewardsCollection = db.collection<RewardDocument>('rewards')

    const reward: RewardDocument = {
      userAddress: userAddress.toLowerCase(),
      type,
      amount,
      questionId,
      answerId,
      transactionHash,
      createdAt: new Date(),
    }

    await rewardsCollection.insertOne(reward)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('보상 추가 실패:', error)
    return NextResponse.json(
      { error: '보상 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}







