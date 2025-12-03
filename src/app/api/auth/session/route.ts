import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null })
    }

    // JWT 토큰 검증
    const payload = await verifyToken(token)

    if (!payload) {
      // 만료되거나 유효하지 않은 토큰 쿠키 삭제
      const response = NextResponse.json({ authenticated: false, user: null })
      response.cookies.delete('token')
      return response
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: payload.email,
      },
    })
  } catch (error: any) {
    console.error('세션 확인 실패:', error)
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    )
  }
}

