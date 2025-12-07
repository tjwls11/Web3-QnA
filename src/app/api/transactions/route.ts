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

    // 인증이 없으면 빈 배열 반환
    if (!token) {
      return NextResponse.json({
        transactions: [],
      })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({
        transactions: [],
      })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const transactionsCollection =
      db.collection<TransactionDocument>('transactions')

    const transactions = await transactionsCollection
      .find({ userEmail: payload.email })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      transactions: transactions.map((t) => {
        const isExchange = t.type === 'exchange'
        // 환전은 +, 출금은 -
        const signedWakAmount = isExchange ? t.wakAmount : -t.wakAmount

        return {
          // 한글 라벨로 변환
          type: isExchange ? '환전' : '출금',
          ethAmount: t.ethAmount,
          wakAmount: signedWakAmount,
          transactionHash: t.transactionHash,
          status:
            t.status === 'completed'
              ? '완료'
              : t.status === 'pending'
              ? '대기중'
              : '실패',
          date: t.createdAt.toLocaleDateString('ko-KR'),
          time: t.createdAt.toLocaleTimeString('ko-KR'),
          createdAt: t.createdAt.getTime(),
        }
      }),
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
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '토큰이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    // 필수 값 확인 (0은 허용, undefined/null만 체크)
    if (
      !type ||
      ethAmount === undefined ||
      ethAmount === null ||
      wakAmount === undefined ||
      wakAmount === null ||
      !userAddress
    ) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const transactionsCollection =
      db.collection<TransactionDocument>('transactions')

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('거래 내역 추가 실패:', error)
    return NextResponse.json(
      { error: '거래 내역 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}
