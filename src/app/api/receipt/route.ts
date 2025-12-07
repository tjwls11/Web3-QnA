import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { NETWORK_CONFIG, CONTRACT_ADDRESSES } from '@/lib/web3/config'
import {
  JsonRpcProvider,
  Wallet,
  Interface,
  keccak256,
  toUtf8Bytes,
} from 'ethers'
import { QNA_CONTRACT_ABI } from '@/lib/contracts/abi'

// GET /api/receipt?txHash=...&questionId=...&answerId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const txHash = searchParams.get('txHash')
    const questionIdParam = searchParams.get('questionId')
    const answerIdParam = searchParams.get('answerId')

    console.log('[영수증-GET] 요청 수신:', {
      txHash,
      questionIdParam,
      answerIdParam,
    })

    if (!txHash) {
      return NextResponse.json(
        { error: 'txHash는 필수입니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const receiptsCollection = db.collection('receipts')
    const questionsCollection = db.collection('questions')

    // 1. 먼저 DB에 이미 저장된 영수증이 있는지 확인 (txHash 기준)
    const existing = await receiptsCollection.findOne({ txHash })
    if (existing) {
      console.log('[영수증-GET] 기존 영수증 반환 (DB 캐시 사용):', {
        id: existing._id.toString(),
        txHash,
      })
      return NextResponse.json({
        receipt: {
          id: existing._id.toString(),
          ...existing,
        },
      })
    }

    // 2. 온체인 트랜잭션/영수증 조회 (실패해도 최소 정보로 영수증 생성)
    let onchainReceipt: any = null
    let onchainTx: any = null
    let onchainBlock: any = null
    let parsedQuestionId: string | null = null
    let parsedAnswerId: string | null = null
    let answerAuthor: string | null = null
    let rewardWei: string | null = null

    try {
      const provider = new JsonRpcProvider(NETWORK_CONFIG.rpcUrl, {
        chainId: NETWORK_CONFIG.chainId,
        name: NETWORK_CONFIG.name,
      })

      onchainReceipt = await provider.getTransactionReceipt(txHash)
      if (onchainReceipt) {
        onchainTx = await provider.getTransaction(txHash)
        onchainBlock = await provider.getBlock(onchainReceipt.blockNumber)

        // QnA AnswerAccepted 이벤트 파싱 시도
        const qnaInterface = new Interface(QNA_CONTRACT_ABI)
        const contractAddress = CONTRACT_ADDRESSES.QNA_CONTRACT?.toLowerCase()

        const contractLogs = onchainReceipt.logs.filter(
          (log: any) => log.address?.toLowerCase() === contractAddress
        )

        for (const log of contractLogs) {
          try {
            const parsed = qnaInterface.parseLog({
              topics: Array.from(log.topics),
              data: log.data,
            })
            if (parsed?.name === 'AnswerAccepted') {
              // 이벤트 시그니처: AnswerAccepted(uint256 questionId, uint256 answerId, address answerAuthor, uint256 reward)
              parsedQuestionId = parsed.args[0]?.toString() || null
              parsedAnswerId = parsed.args[1]?.toString() || null
              answerAuthor = (parsed.args[2] as string) || null
              rewardWei = parsed.args[3]?.toString() || null
              break
            }
          } catch {
            // 다른 이벤트면 무시
            continue
          }
        }
      } else {
        console.warn('[영수증-GET] 온체인 영수증을 찾을 수 없습니다:', {
          txHash,
        })
      }
    } catch (rpcError: any) {
      console.warn('[영수증-GET] 온체인 정보 조회 실패 (RPC):', {
        message: rpcError?.message,
        code: rpcError?.code,
      })
    }

    const questionId = questionIdParam || parsedQuestionId || '0'
    const answerId = answerIdParam || parsedAnswerId || '0'

    // 질문 정보 (제목/태그/보상) 조회
    const questionDoc =
      questionId && questionId !== '0'
        ? await questionsCollection.findOne({ id: questionId })
        : null

    const rewardFromQuestion =
      typeof questionDoc?.reward === 'number'
        ? questionDoc.reward.toString()
        : questionDoc?.reward?.toString?.() || '0'

    const finalRewardWei = rewardWei || rewardFromQuestion || '0'
    const rewardNormalized = Number(finalRewardWei) / 1e18

    const tags: string[] = Array.isArray(questionDoc?.tags)
      ? questionDoc.tags
      : []
    const questionTitle: string = questionDoc?.title || ''
    const questionAuthor =
      (questionDoc?.author as string | undefined)?.toLowerCase() || null
    const normalizedAnswerAuthor = answerAuthor
      ? answerAuthor.toLowerCase()
      : null

    const network = NETWORK_CONFIG.name
    const chainId = NETWORK_CONFIG.chainId
    const qnaContract = CONTRACT_ADDRESSES.QNA_CONTRACT
    const wakToken = CONTRACT_ADDRESSES.TOKEN_CONTRACT

    const blockNumber = onchainReceipt?.blockNumber
      ? Number(onchainReceipt.blockNumber)
      : 0
    const blockHash = onchainReceipt?.blockHash || ''
    const status: 'success' | 'failed' =
      onchainReceipt?.status === 0 ? 'failed' : 'success'

    const gasUsed = onchainReceipt?.gasUsed?.toString?.() || ''
    const gasPrice = onchainTx?.gasPrice?.toString?.() || ''

    const acceptedAtSec =
      onchainBlock?.timestamp ?? Math.floor(Date.now() / 1000)
    const acceptedAtMs = acceptedAtSec * 1000

    const tokenSymbol = 'WAK'
    const decimals = 18

    const core = {
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
      questionAuthor,
      answerAuthor: normalizedAnswerAuthor,
      reward: finalRewardWei,
      rewardNormalized,
      tokenSymbol,
      decimals,
      acceptedAt: acceptedAtMs,
    }

    // 서명 생성 (플랫폼 키가 설정된 경우)
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
        console.warn('[영수증-GET] 서명 생성 실패 (서명 없이 계속):', {
          message: signError?.message,
        })
      }
    }

    const explorerBase =
      chainId === 1
        ? 'https://etherscan.io/tx/'
        : 'https://sepolia.etherscan.io/tx/'

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
      participants: [questionAuthor, normalizedAnswerAuthor].filter(Boolean),
    }

    const insertResult = await receiptsCollection.insertOne(doc)

    console.log('[영수증-GET] 새 영수증 저장 완료:', {
      id: insertResult.insertedId.toString(),
      txHash,
      questionId,
      answerId,
      questionAuthor,
      answerAuthor: normalizedAnswerAuthor,
    })

    return NextResponse.json({
      receipt: {
        id: insertResult.insertedId.toString(),
        ...doc,
      },
    })
  } catch (error: any) {
    console.error('[영수증-GET] 생성 실패:', error)
    return NextResponse.json(
      { error: '영수증 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
