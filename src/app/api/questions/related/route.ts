import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

interface QuestionDocument {
  id: string
  title: string
  tags?: string[]
  answerCount?: number
  reward?: number
  createdAt?: Date
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId') // 현재 보고 있는 질문 ID
    const tagsParam = searchParams.get('tags') // "react,next.js" 이런 식
    const limitParam = searchParams.get('limit') || '3'

    if (!tagsParam) {
      return NextResponse.json({ related: [] })
    }

    const tags = tagsParam
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    if (tags.length === 0) {
      return NextResponse.json({ related: [] })
    }

    const limit = Math.max(1, Math.min(parseInt(limitParam, 10) || 3, 10))

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection<QuestionDocument>('questions')

    const filter: any = {
      tags: { $in: tags }, // 태그 하나라도 겹치는 질문
    }

    if (questionId) {
      // 자기 자신은 제외
      filter.id = { $ne: questionId.toString() }
    }

    const docs = await questionsCollection
      .find(filter)
      // 답변 많은 순 -> 최신 순 정렬
      .sort({ answerCount: -1, createdAt: -1 })
      .limit(limit)
      .toArray()

    const related = docs.map((q) => ({
      id: q.id?.toString() ?? '',
      title: q.title ?? '',
      answerCount: q.answerCount ?? 0,
      reward: Number(q.reward ?? 0),
    }))

    return NextResponse.json({ related })
  } catch (error: any) {
    console.error('[관련 질문] 조회 실패:', error)
    return NextResponse.json(
      { error: '관련 질문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
