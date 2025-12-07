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

// 이번 주 랭킹 (이번 주 월요일 00:00 ~ 다음 주 월요일 00:00)
// answers.author + answers.isAccepted 기준 집계
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('wakqna')

    const answersCollection = db.collection('answers')
    const usersCollection = db.collection('users')

    const now = new Date()

    // 이번 주 월요일 00:00
    const weekStart = new Date(now)
    const day = weekStart.getDay() // 0: 일요일, 1: 월요일, ...
    const diffToMonday = (day + 6) % 7
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - diffToMonday)

    // 다음 주 월요일 00:00
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const ACCEPTED_BONUS = 5

    // 1) 이번 주에 작성된 답변을 author 기준으로 집계
    const aggregated = await answersCollection
      .aggregate([
        {
          $match: {
            createdAt: { $gte: weekStart, $lt: weekEnd },
            author: { $ne: null, $exists: true },
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
      ])
      .toArray()

    const filtered = aggregated.filter(
      (row: any) => row._id !== null && row._id !== undefined
    )

    if (filtered.length === 0) {
      return NextResponse.json({
        range: 'this_week',
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
        top: [] as WeeklyRankItem[],
      })
    }

    // 2) users 컬렉션에서 닉네임 조인
    const authorAddresses = filtered.map((row: any) => String(row._id))

    const users = await usersCollection
      .find({ address: { $in: authorAddresses } })
      .project({
        address: 1,
        userName: 1,
      })
      .toArray()

    const userMap = new Map<string, { userName: string }>()
    users.forEach((u: any) => {
      if (!u.address) return
      const key = String(u.address).toLowerCase()
      userMap.set(key, { userName: u.userName || '' })
    })

    // 3) 점수 계산 + 랭킹 부여
    let results: WeeklyRankItem[] = filtered.map((row: any) => {
      const address = String(row._id)
      const key = address.toLowerCase()
      const profile = userMap.get(key)

      const answersCount = row.answersCount || 0
      const acceptedCount = row.acceptedCount || 0
      const score = answersCount + acceptedCount * ACCEPTED_BONUS

      return {
        address,
        userName: profile?.userName || '',
        answersCount,
        acceptedCount,
        score,
        rank: 0,
      }
    })

    results = results.filter(
      (item) =>
        item.address && item.address !== 'null' && item.address !== 'undefined'
    )

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.acceptedCount !== a.acceptedCount) {
        return b.acceptedCount - a.acceptedCount
      }
      return b.answersCount - a.answersCount
    })

    results = results.map((item, index) => ({
      ...item,
      rank: index + 1,
    }))

    const top = results.slice(0, 50)

    return NextResponse.json({
      range: 'this_week',
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
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
