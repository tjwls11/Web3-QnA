import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // JWT는 서버에 저장하지 않으므로 쿠키만 삭제
    const response = NextResponse.json({ success: true })
    response.cookies.delete('token')

    return response
  } catch (error: any) {
    console.error('로그아웃 실패:', error)
    return NextResponse.json(
      { error: '로그아웃에 실패했습니다.' },
      { status: 500 }
    )
  }
}
