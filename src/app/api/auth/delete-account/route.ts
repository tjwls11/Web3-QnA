import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

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

    // 사용자 확인
    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 거래 내역 삭제
    const transactionsCollection = db.collection('transactions')
    await transactionsCollection.deleteMany({
      userEmail: payload.email,
    })

    // 사용자 삭제
    await authUsersCollection.deleteOne({
      email: payload.email,
    })

    // 관련 데이터 정리 (선택사항)
    // 사용자가 작성한 질문, 답변 등은 유지할 수도 있고 삭제할 수도 있음
    // 여기서는 사용자 정보만 삭제하고 질문/답변은 유지

    // 쿠키 삭제
    const response = NextResponse.json({ 
      success: true,
      walletAddress: user.walletAddress || null,
      tokenBalance: user.tokenBalance || 0,
    })
    response.cookies.delete('token')

    return response
  } catch (error: any) {
    console.error('회원탈퇴 실패:', error)
    return NextResponse.json(
      { error: '회원탈퇴에 실패했습니다.' },
      { status: 500 }
    )
  }
}

