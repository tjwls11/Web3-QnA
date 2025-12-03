import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// 유저 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, userName } = body

    if (!address || !userName) {
      return NextResponse.json(
        { error: '주소와 사용자 이름이 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const usersCollection = db.collection('users')

    // 이미 등록된 사용자인지 확인
    const normalizedAddress = address.toLowerCase()
    const existingUser = await usersCollection.findOne({
      address: normalizedAddress,
    })

    if (existingUser) {
      console.log('[유저 등록] 이미 등록된 지갑 주소:', {
        address: normalizedAddress,
        existingUserName: existingUser.userName,
      })
      return NextResponse.json(
        { error: `이미 등록된 지갑 주소입니다. (등록된 계정: ${existingUser.userName})` },
        { status: 400 }
      )
    }

    // 새 사용자 등록
    const newUser = {
      address: normalizedAddress,
      userName,
      registeredAt: new Date(),
      questionCount: 0,
      answerCount: 0,
      acceptedAnswerCount: 0,
      reputation: 0,
    }

    console.log('[유저 등록] 새 사용자 등록:', {
      address: normalizedAddress,
      userName,
    })

    const result = await usersCollection.insertOne(newUser)
    
    console.log('[유저 등록] 등록 완료:', {
      address: normalizedAddress,
      userName,
      insertedId: result.insertedId,
    })

    return NextResponse.json({
      success: true,
      user: {
        ...newUser,
        _id: result.insertedId,
      },
    })
  } catch (error: any) {
    console.error('유저 등록 실패:', error)
    return NextResponse.json(
      { error: '유저 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 유저 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    const client = await clientPromise
    const db = client.db('wakqna')
    const usersCollection = db.collection('users')

    if (address) {
      // 특정 주소의 유저 조회
      const user = await usersCollection.findOne({
        address: address.toLowerCase(),
      })

      if (!user) {
        return NextResponse.json({ user: null })
      }

      return NextResponse.json({
        user: {
          address: user.address,
          userName: user.userName,
          registeredAt: user.registeredAt.getTime(),
          questionCount: user.questionCount || 0,
          answerCount: user.answerCount || 0,
          acceptedAnswerCount: user.acceptedAnswerCount || 0,
          reputation: user.reputation || 0,
        },
      })
    } else {
      // 모든 유저 조회
      const users = await usersCollection.find({}).toArray()

      return NextResponse.json({
        users: users.map((user) => ({
          address: user.address,
          userName: user.userName,
          registeredAt: user.registeredAt.getTime(),
          questionCount: user.questionCount || 0,
          answerCount: user.answerCount || 0,
          acceptedAnswerCount: user.acceptedAnswerCount || 0,
          reputation: user.reputation || 0,
        })),
      })
    }
  } catch (error: any) {
    console.error('유저 조회 실패:', error)
    return NextResponse.json(
      { error: '유저 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 유저 정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      address,
      userName,
      questionCount,
      answerCount,
      acceptedAnswerCount,
      reputation,
    } = body

    if (!address) {
      return NextResponse.json({ error: '주소가 필요합니다.' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const usersCollection = db.collection('users')

    const updateData: any = {}
    if (userName) updateData.userName = userName
    if (questionCount !== undefined) updateData.questionCount = questionCount
    if (answerCount !== undefined) updateData.answerCount = answerCount
    if (acceptedAnswerCount !== undefined)
      updateData.acceptedAnswerCount = acceptedAnswerCount
    if (reputation !== undefined) updateData.reputation = reputation

    const result = await usersCollection.updateOne(
      { address: address.toLowerCase() },
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
    console.error('유저 업데이트 실패:', error)
    return NextResponse.json(
      { error: '유저 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}
