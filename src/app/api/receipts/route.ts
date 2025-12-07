import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'
import { NETWORK_CONFIG, CONTRACT_ADDRESSES } from '@/lib/web3/config'
import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers'

type ReceiptCore = {
  version: string
  network: string
  chainId: number
  qnaContract: string
  wakToken: string
  txHash: string
  blockNumber: number
  blockHash: string
  status: 'success' | 'failed'
  questionId: string
  answerId: string
  questionAuthor: string
  answerAuthor: string
  reward: string
  rewardNormalized: number
  tokenSymbol: string
  decimals: number
  acceptedAt: number
}

// 영수증 생성
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
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

    const body = await request.json()
    const {
      questionId,
      answerId,
      txHash,
      blockNumber: clientBlockNumber,
      blockHash: clientBlockHash,
      status: clientStatus,
      gasUsed: clientGasUsed,
      questionAuthor,
      answerAuthor,
      rewardWei,
    } = body || {}

    if (!questionId || !answerId || !txHash) {
      console.error('[영수증] 필수 필드 누락:', {
        questionId,
        answerId,
        txHash,
      })
      return NextResponse.json(
        { error: 'questionId, answerId, txHash는 필수입니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')
    const receiptsCollection = db.collection('receipts')

    const questionDoc: any = await questionsCollection.findOne({
      id: questionId.toString(),
    })

    const normalizedQuestionAuthor = questionAuthor
      ? String(questionAuthor).toLowerCase()
      : null
    const normalizedAnswerAuthor = answerAuthor
      ? String(answerAuthor).toLowerCase()
      : null

    let onchainReceipt: any = null
    let onchainTx: any = null
    let onchainBlock: any = null

    try {
      const provider = new JsonRpcProvider(NETWORK_CONFIG.rpcUrl, {
        chainId: NETWORK_CONFIG.chainId,
        name: NETWORK_CONFIG.name,
      })

      onchainReceipt = await provider.getTransactionReceipt(txHash)
      if (!onchainReceipt) {
        console.warn(
          '[영수증] 온체인 트랜잭션 영수증을 찾을 수 없습니다. 클라이언트 제공 값만 사용합니다.',
          { txHash }
        )
      } else {
        onchainTx = await provider.getTransaction(txHash)
        onchainBlock = await provider.getBlock(onchainReceipt.blockNumber)
      }
    } catch (rpcError: any) {
      console.warn(
        '[영수증] 온체인 정보 조회 실패 (RPC 오류, 클라이언트 제공 값만 사용):',
        {
          message: rpcError?.message,
          code: rpcError?.code,
        }
      )
    }

    const network = NETWORK_CONFIG.name
    const chainId = NETWORK_CONFIG.chainId
    const qnaContract = CONTRACT_ADDRESSES.QNA_CONTRACT
    const wakToken = CONTRACT_ADDRESSES.TOKEN_CONTRACT

    const blockNumber =
      typeof clientBlockNumber === 'number'
        ? clientBlockNumber
        : onchainReceipt?.blockNumber
        ? Number(onchainReceipt.blockNumber)
        : 0
    const blockHash =
      typeof clientBlockHash === 'string'
        ? clientBlockHash
        : onchainReceipt?.blockHash || ''
    const status: 'success' | 'failed' =
      clientStatus === 'failed' || onchainReceipt?.status === 0
        ? 'failed'
        : 'success'

    const gasUsed =
      typeof clientGasUsed === 'string'
        ? clientGasUsed
        : onchainReceipt?.gasUsed?.toString?.() || ''
    const gasPrice = onchainTx?.gasPrice?.toString?.() || ''

    const acceptedAtSec =
      onchainBlock?.timestamp ?? Math.floor(Date.now() / 1000)
    const acceptedAtMs = acceptedAtSec * 1000

    const rewardFromQuestion =
      typeof questionDoc?.reward === 'number'
        ? questionDoc.reward.toString()
        : questionDoc?.reward?.toString?.() || '0'
    const reward = rewardWei || rewardFromQuestion || '0'
    const rewardNormalized = Number(reward) / 1e18

    const tags: string[] = Array.isArray(questionDoc?.tags)
      ? questionDoc.tags
      : []
    const questionTitle: string = questionDoc?.title || ''

    const tokenSymbol = 'WAK'
    const decimals = 18

    const core: ReceiptCore = {
      version: '1',
      network,
      chainId,
      qnaContract,
      wakToken,
      txHash,
      blockNumber,
      blockHash,
      status,
      questionId: questionId.toString(),
      answerId: answerId.toString(),
      questionAuthor: normalizedQuestionAuthor || '',
      answerAuthor: normalizedAnswerAuthor || '',
      reward,
      rewardNormalized,
      tokenSymbol,
      decimals,
      acceptedAt: acceptedAtMs,
    }

    let signature: string | null = null
    let signedBy: string | null = null

    const platformKey = process.env.PLATFORM_SIGNER_PRIVATE_KEY
    if (platformKey) {
      try {
        const signer = new Wallet(platformKey)
        const message = JSON.stringify(core)
        const hash = keccak256(toUtf8Bytes(message))
        signature = await signer.signMessage(hash)
        signedBy = await signer.getAddress()
      } catch (signError: any) {
        console.error(
          '[영수증] 서명 생성 실패 (서명 없이 계속 진행):',
          signError
        )
        signature = null
        signedBy = null
      }
    } else {
      console.warn(
        '[영수증] PLATFORM_SIGNER_PRIVATE_KEY가 설정되지 않았습니다. 서명 없이 영수증을 저장합니다.'
      )
    }

    const explorerBase =
      chainId === 1
        ? 'https://etherscan.io/tx/'
        : 'https://sepolia.etherscan.io/tx/'

    const participants = [
      normalizedQuestionAuthor,
      normalizedAnswerAuthor,
    ].filter((v): v is string => typeof v === 'string')

    const doc = {
      ...core,
      gasUsed,
      gasPrice,
      tags,
      questionTitle,
      explorerUrl: `${explorerBase}${txHash}`,
      issuedAt: Date.now(),
      signature,
      signedBy,
      participants,
      createdByEmail: payload.email,
    }

    const insertResult = await receiptsCollection.insertOne(doc)

    return NextResponse.json({
      receipt: {
        id: insertResult.insertedId.toString(),
        ...doc,
      },
    })
  } catch (error: any) {
    console.error('[영수증] 생성 실패:', error)
    return NextResponse.json(
      { error: '영수증 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 현재 사용자 영수증 조회
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ receipts: [] }, { status: 200 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ receipts: [] }, { status: 200 })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const receiptsCollection = db.collection('receipts')
    const authUsersCollection = db.collection('authUsers')

    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    const walletAddress: string | null = user?.walletAddress
      ? String(user.walletAddress).toLowerCase()
      : null

    const { searchParams } = new URL(request.url)
    const questionIdFilter = searchParams.get('questionId')
    const answerIdFilter = searchParams.get('answerId')

    const query: any = {}

    if (questionIdFilter) {
      query.questionId = questionIdFilter.toString()
      if (answerIdFilter) {
        query.answerId = answerIdFilter.toString()
      }
    } else {
      if (walletAddress) {
        query.participants = walletAddress
      } else {
        query.createdByEmail = payload.email
      }
      if (answerIdFilter) {
        query.answerId = answerIdFilter.toString()
      }
    }

    const docs = await receiptsCollection
      .find(query)
      .sort({ acceptedAt: -1 })
      .limit(100)
      .toArray()

    if (!docs || docs.length === 0) {
      console.warn('[영수증] 조회 결과 없음:', {
        query,
        message:
          '이 사용자/질문에 연결된 영수증이 없습니다. (아직 생성되지 않았거나, participants 필터에 해당 지갑 주소가 없습니다.)',
      })
    }

    const receipts = docs.map((doc: any) => {
      const id = doc._id.toString()
      const qa = doc.questionAuthor
      const aa = doc.answerAuthor

      let role: 'questioner' | 'answerer' | 'other' = 'other'
      if (walletAddress) {
        if (walletAddress === qa) role = 'questioner'
        else if (walletAddress === aa) role = 'answerer'
      }

      return {
        id,
        version: doc.version,
        network: doc.network,
        chainId: doc.chainId,
        qnaContract: doc.qnaContract,
        wakToken: doc.wakToken,
        txHash: doc.txHash,
        blockNumber: doc.blockNumber,
        blockHash: doc.blockHash,
        status: doc.status,
        gasUsed: doc.gasUsed,
        gasPrice: doc.gasPrice,
        explorerUrl: doc.explorerUrl,
        questionId: doc.questionId,
        answerId: doc.answerId,
        questionAuthor: qa,
        answerAuthor: aa,
        reward: doc.reward,
        rewardNormalized: doc.rewardNormalized,
        tokenSymbol: doc.tokenSymbol,
        decimals: doc.decimals,
        tags: doc.tags || [],
        questionTitle: doc.questionTitle || '',
        acceptedAt: doc.acceptedAt,
        issuedAt: doc.issuedAt,
        signature: doc.signature || null,
        signedBy: doc.signedBy || null,
        role,
      }
    })

    return NextResponse.json({ receipts })
  } catch (error: any) {
    console.error('[영수증] 조회 실패:', error)
    return NextResponse.json({ receipts: [] }, { status: 200 })
  }
}
