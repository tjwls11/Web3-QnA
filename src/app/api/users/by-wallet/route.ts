import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// 지갑 주소로 사용자 정보 조회 (프로필사진 포함)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const authUsersCollection = db.collection('authUsers')

    // 지갑 주소로 사용자 정보 조회
    const user = await authUsersCollection.findOne({
      walletAddress: walletAddress.toLowerCase(),
    })

    if (!user) {
      // authUsers에 없으면 users 컬렉션에서 확인
      const usersCollection = db.collection('users')
      const userFromUsers = await usersCollection.findOne({
        address: walletAddress.toLowerCase(),
      })

      if (userFromUsers) {
        return NextResponse.json({
          user: {
            userName: userFromUsers.userName || '',
            avatarUrl: null,
          },
        })
      }

      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        userName: user.userName || '',
        avatarUrl: user.avatarUrl || null,
      },
    })
  } catch (error: any) {
    console.error('사용자 정보 조회 실패:', error)
    return NextResponse.json(
      { error: '사용자 정보 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}





