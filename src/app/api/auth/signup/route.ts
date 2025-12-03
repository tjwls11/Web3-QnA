import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { createToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, userName } = body

    if (!email || !password || !userName) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 닉네임이 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 이미 등록된 사용자인지 확인
    const existingUser = await authUsersCollection.findOne({
      email: email.toLowerCase(),
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다.' },
        { status: 400 }
      )
    }

    // 새 사용자 등록 (실제로는 비밀번호를 해시해야 함)
    const newUser = {
      email: email.toLowerCase(),
      password, // 실제 프로덕션에서는 bcrypt 등으로 해시
      userName: userName.trim(),
      createdAt: new Date(),
      walletAddress: null, // 지갑 연결 시 업데이트
      tokenBalance: 0, // 초기 토큰 잔액은 0
      questionCount: 0,
      answerCount: 0,
      acceptedAnswerCount: 0,
      reputation: 0,
    }

    await authUsersCollection.insertOne(newUser)

    // JWT 토큰 생성
    const token = await createToken(email.toLowerCase())

    // 쿠키 설정
    const response = NextResponse.json({ success: true, email: email.toLowerCase() })
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7일
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('회원가입 실패:', error)
    return NextResponse.json(
      { error: '회원가입에 실패했습니다.' },
      { status: 500 }
    )
  }
}

