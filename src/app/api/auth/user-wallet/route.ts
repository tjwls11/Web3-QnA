import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

// 유저의 지갑 주소 조회
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ walletAddress: null })
    }

    // JWT 토큰 검증
    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ walletAddress: null })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 유저의 지갑 주소 조회
    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    return NextResponse.json({
      walletAddress: user?.walletAddress || null,
    })
  } catch (error: any) {
    console.error('지갑 주소 조회 실패:', error)
    return NextResponse.json({ walletAddress: null }, { status: 500 })
  }
}

// 유저의 지갑 주소 저장 (지갑 주소만 저장, 토큰 잔액은 DB 기준으로 유지)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const body = await request.json()
    const { walletAddress } = body

    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: '지갑 주소가 필요합니다.' },
        { status: 400 }
      )
    }

    // JWT 토큰 검증
    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: '토큰이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 기존 DB 토큰 잔액 유지 (ETH -> WAK 환전, 답변 채택 등으로만 변동)
    const existingUser = await authUsersCollection.findOne({
      email: payload.email,
    })
    const currentBalance = existingUser?.tokenBalance || 0

    // 유저의 지갑 주소만 저장, 토큰 잔액은 기존 값 유지
    await authUsersCollection.updateOne(
      { email: payload.email },
      { 
        $set: { 
          walletAddress: walletAddress.toLowerCase(),
          tokenBalance: currentBalance, // 내부 포인트 잔액 유지
        },
      },
      { upsert: true }
    )

    console.log('[지갑 연결] 지갑 주소 저장 완료 (토큰 잔액은 DB 기준 유지):', {
      walletAddress: walletAddress.toLowerCase(),
      tokenBalance: currentBalance,
      unit: 'WAK',
    })

    return NextResponse.json({ success: true, tokenBalance: currentBalance })
  } catch (error: any) {
    console.error('지갑 주소 저장 실패:', error)
    return NextResponse.json(
      { error: '지갑 주소 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
