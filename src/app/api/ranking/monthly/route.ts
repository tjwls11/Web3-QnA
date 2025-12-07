import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

type MonthlyRankItem = {
  address: string
  userName: string
  answersCount: number
  acceptedCount: number
  score: number
  rank: number
}

// 이번 달 랭킹 (해당 달 1일 00:00 ~ 다음 달 1일 00:00)
// answers.author + answers.isAccepted 기준 집계
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('wakqna')

    const answersCollection = db.collection('answers')
    const usersCollection = db.collection('users')

    const now = new Date()
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    )
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )

    const ACCEPTED_BONUS = 5

    // 1) 이번 달에 작성된 답변을 author 기준으로 집계
    const aggregated = await answersCollection
      .aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lt: monthEnd },
            // answers 컬렉션의 작성자 필드 이름: author
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

    // _id(null) 방지용 필터
    const filtered = aggregated.filter(
      (row: any) => row._id !== null && row._id !== undefined
    )

    if (filtered.length === 0) {
      return NextResponse.json({
        month: `${monthStart.getFullYear()}-${String(
          monthStart.getMonth() + 1
        ).padStart(2, '0')}`,
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
        top: [] as MonthlyRankItem[],
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
    let results: MonthlyRankItem[] = filtered.map((row: any) => {
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

    // 주소 이상치 제거
    results = results.filter(
      (item) =>
        item.address && item.address !== 'null' && item.address !== 'undefined'
    )

    // 점수 > 채택 수 > 답변 수 순으로 정렬
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.acceptedCount !== a.acceptedCount) {
        return b.acceptedCount - a.acceptedCount
      }
      return b.answersCount - a.answersCount
    })

    // 1부터 순위 부여
    results = results.map((item, index) => ({
      ...item,
      rank: index + 1,
    }))

    // 상위 50명까지만 사용
    const top = results.slice(0, 50)

    return NextResponse.json({
      month: `${monthStart.getFullYear()}-${String(
        monthStart.getMonth() + 1
      ).padStart(2, '0')}`,
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
      top,
    })
  } catch (error: any) {
    console.error('[월간 랭킹] 조회 실패:', error)
    return NextResponse.json(
      { error: '월간 랭킹 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
