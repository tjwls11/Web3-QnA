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

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('wakqna')

    const answersCollection = db.collection('answers')
    const usersCollection = db.collection('users')

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const ACCEPTED_BONUS = 5

    // 1) 최근 7일간 작성된 답변 집계
    const aggregated = await answersCollection
      .aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo, $lt: now },
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
        range: 'last_7_days',
        start: sevenDaysAgo.toISOString(),
        end: now.toISOString(),
        top: [] as WeeklyRankItem[],
      })
    }

    const authorAddresses = filtered.map((row: any) => String(row._id))

    const users = await usersCollection
      .find({ address: { $in: authorAddresses } })
      .project({ address: 1, userName: 1 })
      .toArray()

    const userMap = new Map<string, { userName: string }>()
    users.forEach((u: any) => {
      if (!u.address) return
      const key = String(u.address).toLowerCase()
      userMap.set(key, { userName: u.userName || '' })
    })

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
      range: 'last_7_days',
      start: sevenDaysAgo.toISOString(),
      end: now.toISOString(),
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
