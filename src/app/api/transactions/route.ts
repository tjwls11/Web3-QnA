import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

interface TransactionDocument {
  userEmail: string
  userAddress: string
  type: 'exchange' | 'withdraw' // 환전 또는 출금
  ethAmount: number // ETH 금액
  wakAmount: number // WAK 토큰 금액
  transactionHash?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
}

// 거래 내역 조회
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

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
    const transactionsCollection = db.collection<TransactionDocument>('transactions')

    // 사용자 이메일로 조회
    const transactions = await transactionsCollection
      .find({ userEmail: payload.email })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        type: t.type === 'exchange' ? '환전' : '출금',
        ethAmount: t.ethAmount,
        wakAmount: t.wakAmount,
        transactionHash: t.transactionHash,
        status: t.status === 'completed' ? '완료' : t.status === 'pending' ? '대기중' : '실패',
        date: t.createdAt.toLocaleDateString('ko-KR'),
        time: t.createdAt.toLocaleTimeString('ko-KR'),
        createdAt: t.createdAt.getTime(),
      })),
    })
  } catch (error: any) {
    console.error('거래 내역 조회 실패:', error)
    return NextResponse.json(
      { error: '거래 내역 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 거래 내역 추가
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const body = await request.json()
    const { type, ethAmount, wakAmount, transactionHash, userAddress } = body

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

    if (!type || !ethAmount || !wakAmount || !userAddress) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const transactionsCollection = db.collection<TransactionDocument>('transactions')

    const transaction: TransactionDocument = {
      userEmail: payload.email,
      userAddress: userAddress.toLowerCase(),
      type: type === 'exchange' ? 'exchange' : 'withdraw',
      ethAmount: Number(ethAmount),
      wakAmount: Number(wakAmount),
      transactionHash: transactionHash || undefined,
      status: transactionHash ? 'completed' : 'pending',
      createdAt: new Date(),
    }

    await transactionsCollection.insertOne(transaction)

    // 사용자의 토큰 잔액 업데이트
    const authUsersCollection = db.collection('authUsers')
    if (type === 'exchange') {
      // 환전: 토큰 잔액 증가
      await authUsersCollection.updateOne(
        { email: payload.email },
        { $inc: { tokenBalance: Number(wakAmount) } }
      )
    } else if (type === 'withdraw') {
      // 출금: 토큰 잔액 감소
      await authUsersCollection.updateOne(
        { email: payload.email },
        { $inc: { tokenBalance: -Number(wakAmount) } }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('거래 내역 추가 실패:', error)
    return NextResponse.json(
      { error: '거래 내역 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}



