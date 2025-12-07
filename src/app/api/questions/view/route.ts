import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// 조회수 증가 전용 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: '질문 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')

    const questionId = id.toString()

    const result = await questionsCollection.findOneAndUpdate(
      { id: questionId },
      { $inc: { viewCount: 1 } },
      { returnDocument: 'after' }
    )

    if (!result?.value) {
      return NextResponse.json(
        { error: '질문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const viewCount = result.value.viewCount || 0

    return NextResponse.json({
      success: true,
      viewCount,
    })
  } catch (error: any) {
    console.error('[질문 조회수] 증가 실패:', error)
    return NextResponse.json(
      { error: '질문 조회수 증가에 실패했습니다.' },
      { status: 500 }
    )
  }
}
