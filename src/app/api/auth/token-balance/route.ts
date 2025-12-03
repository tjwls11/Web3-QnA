import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

// 토큰 잔액 업데이트
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const body = await request.json()
    const { tokenBalance } = body

    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // JWT 토큰 검증
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '토큰이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    if (tokenBalance === undefined || tokenBalance === null) {
      return NextResponse.json(
        { error: '토큰 잔액이 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 사용자 정보 조회
    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const currentBalance = user.tokenBalance || 0
    const newBalanceValue = Number(tokenBalance)

    // 음수면 차감, 양수면 설정
    let newBalance: number
    if (newBalanceValue < 0) {
      // 차감 (음수 값)
      newBalance = Math.max(0, currentBalance + newBalanceValue)
    } else {
      // 설정 (양수 값)
      newBalance = newBalanceValue
    }

    // 토큰 잔액 업데이트
    const result = await authUsersCollection.updateOne(
      { email: payload.email },
      { $set: { tokenBalance: newBalance } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('토큰 잔액 업데이트 실패:', error)
    return NextResponse.json(
      { error: '토큰 잔액 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}
