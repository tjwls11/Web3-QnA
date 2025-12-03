import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

// 현재 로그인한 사용자 정보 조회
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ user: null })
    }

    // JWT 토큰 검증
    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ user: null })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 유저 정보 조회
    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    // 레벨 계산: 초기 레벨 1, 답변 1개당 레벨 1 증가
    const answerCount = user.answerCount || 0
    const level = 1 + answerCount

    return NextResponse.json({
      user: {
        email: user.email,
        userName: user.userName || '',
        walletAddress: user.walletAddress || null,
        avatarUrl: user.avatarUrl || null,
        tokenBalance: user.tokenBalance || 0,
        questionCount: user.questionCount || 0,
        answerCount: answerCount,
        acceptedAnswerCount: user.acceptedAnswerCount || 0,
        reputation: user.reputation || 0,
        level: level,
        createdAt: user.createdAt.getTime(),
      },
    })
  } catch (error: any) {
    console.error('사용자 정보 조회 실패:', error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}

// 사용자 정보 업데이트 (이름, 프로필 사진)
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const body = await request.json()
    const { userName, avatarUrl } = body

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
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

    // 업데이트할 데이터 준비
    const updateData: any = {}
    if (userName !== undefined) {
      if (!userName || !userName.trim()) {
        return NextResponse.json(
          { error: '이름이 필요합니다.' },
          { status: 400 }
        )
      }
      updateData.userName = userName.trim()
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '업데이트할 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    // 사용자 정보 업데이트
    const result = await authUsersCollection.updateOne(
      { email: payload.email },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('사용자 정보 업데이트 실패:', error)
    return NextResponse.json(
      { error: '사용자 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

