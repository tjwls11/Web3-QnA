import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { createToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 사용자 확인
    const user = await authUsersCollection.findOne({
      email: email.toLowerCase(),
    })

    if (!user) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 비밀번호 확인 (실제로는 해시 비교)
    if (user.password !== password) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

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
    console.error('로그인 실패:', error)
    return NextResponse.json(
      { error: '로그인에 실패했습니다.' },
      { status: 500 }
    )
  }
}

