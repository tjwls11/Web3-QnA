import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

type WeeklyRankItem = {
  address: string
  userName: string
  answersCount: number
  acceptedCount: number
  score: number
  rank: number
}

// 이번 주 랭킹 조회 (최근 7일 기준)
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('wakqna')

    const answersCollection = db.collection('answers')
    const usersCollection = db.collection('users')

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 최근 7일 동안 사용자의 답변 수 / 채택 수 집계
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo, $lt: now },
        },
      },
      {
        $group: {
          _id: '$author',
          answersCount: { $sum: 1 },
          acceptedCount: {
            $sum: {
              $cond: [{ $eq: ['$isAccepted', true] }, 1, 0],
            },
          },
        },
      },
    ]

    const raw = await answersCollection.aggregate(pipeline).toArray()

    // 점수 계산 규칙
    // - 답변 1개당 1점
    // - 채택 1개당 5점 보너스
    const ACCEPTED_BONUS = 5

    const results: WeeklyRankItem[] = []

    for (const item of raw) {
      const address = (item._id as string) || ''
      const answersCount = item.answersCount || 0
      const acceptedCount = item.acceptedCount || 0
      const score = answersCount + acceptedCount * ACCEPTED_BONUS

      const userDoc = await usersCollection.findOne({
        address: address.toLowerCase(),
      })

      results.push({
        address,
        userName: userDoc?.userName || '',
        answersCount,
        acceptedCount,
        score,
        rank: 0, // 나중에 설정
      })
    }

    // 점수 기준 정렬 후 순위 부여
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.acceptedCount !== a.acceptedCount)
        return b.acceptedCount - a.acceptedCount
      return b.answersCount - a.answersCount
    })

    results.forEach((item, index) => {
      item.rank = index + 1
    })

    // 상위 50명만 반환
    const top = results.slice(0, 50)

    return NextResponse.json({
      range: '7d',
      top,
    })
  } catch (error: any) {
    console.error('[주간 랭킹] 조회 실패:', error)
    return NextResponse.json(
      { error: '주간 랭킹 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}


