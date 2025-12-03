import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

interface ActivityDocument {
  userAddress: string
  type: string // 'question_created', 'answer_created', 'answer_accepted', 'bookmark_added', etc.
  content: string
  questionId?: string
  answerId?: string
  createdAt: Date
}

// 활동 기록 조회
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
    const activitiesCollection = db.collection<ActivityDocument>('activities')

    const activities = await activitiesCollection
      .find({ userAddress: userAddress.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    const formatTime = (date: Date): string => {
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (minutes < 1) return '방금 전'
      if (minutes < 60) return `${minutes}분 전`
      if (hours < 24) return `${hours}시간 전`
      if (days < 7) return `${days}일 전`
      return date.toLocaleDateString('ko-KR')
    }

    const typeMap: Record<string, string> = {
      question_created: '질문 작성',
      answer_created: '답변 작성',
      answer_accepted: '답변 채택',
      bookmark_added: '찜 추가',
      bookmark_removed: '찜 제거',
    }

    return NextResponse.json({
      activities: activities.map((a) => ({
        type: typeMap[a.type] || a.type,
        content: a.content,
        time: formatTime(a.createdAt),
        createdAt: a.createdAt.getTime(),
      })),
    })
  } catch (error: any) {
    console.error('활동 기록 조회 실패:', error)
    return NextResponse.json(
      { error: '활동 기록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 활동 기록 추가 (내부용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, type, content, questionId, answerId } = body

    if (!userAddress || !type || !content) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const activitiesCollection = db.collection<ActivityDocument>('activities')

    const activity: ActivityDocument = {
      userAddress: userAddress.toLowerCase(),
      type,
      content,
      questionId,
      answerId,
      createdAt: new Date(),
    }

    await activitiesCollection.insertOne(activity)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('활동 기록 추가 실패:', error)
    return NextResponse.json(
      { error: '활동 기록 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}



