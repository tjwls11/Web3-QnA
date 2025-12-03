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

// 유저의 지갑 주소 저장
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const body = await request.json()
    const { walletAddress } = body

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
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

    // 유저의 지갑 주소 저장
    // 지갑 연결 시 tokenBalance는 0으로 초기화 (새로운 지갑이므로)
    await authUsersCollection.updateOne(
      { email: payload.email },
      { 
        $set: { 
          walletAddress: walletAddress.toLowerCase(),
          tokenBalance: 0, // 지갑 연결 시 토큰 잔액 초기화
        } 
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('지갑 주소 저장 실패:', error)
    return NextResponse.json(
      { error: '지갑 주소 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}

