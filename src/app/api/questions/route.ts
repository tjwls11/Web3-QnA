import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { Document, WithId } from 'mongodb'
import { verifyToken } from '@/lib/jwt'

interface QuestionDocument extends Document {
  id: string
  author: string
  title: string
  content: string
  contentHash?: string
  reward?: number
  tags?: string[]
  createdAt: Date
  status?: string
  answerCount?: number
  acceptedAnswerId?: string
  viewCount?: number
}

// 질문 등록
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      id,
      author,
      title,
      content,
      contentHash,
      reward,
      tags,
      createdAt,
      status = 'open',
      githubUrl,
    } = body

    if (!author || !title || !content) {
      return NextResponse.json(
        { error: '작성자, 제목, 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')
    const authUsersCollection = db.collection('authUsers')
    const notificationsCollection = db.collection('notifications')

    // 질문 ID가 없으면 생성
    const questionId = id || Date.now()
    
    // reward를 WAK 단위로 변환 (wei에서 WAK으로)
    const rewardWAK = reward ? Number(reward) / 1e18 : 0

    // 사용자 정보 조회 및 토큰 잔액 확인
    const user = await authUsersCollection.findOne({
      email: payload.email,
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const currentBalance = user.tokenBalance || 0
    console.log('[질문 등록] 현재 토큰 잔액:', currentBalance, 'WAK')
    console.log('[질문 등록] 필요 토큰:', rewardWAK, 'WAK')

    // 토큰 잔액 확인
    if (currentBalance < rewardWAK) {
      return NextResponse.json(
        { 
          error: `토큰 잔액이 부족합니다. 현재 잔액: ${currentBalance.toFixed(2)} WAK, 필요: ${rewardWAK.toFixed(2)} WAK` 
        },
        { status: 400 }
      )
    }

    const newQuestion = {
      id: questionId.toString(),
      author: author.toLowerCase(),
      title,
      content,
      contentHash: contentHash || '',
      reward: reward ? Number(reward) : 0, // wei 단위로 저장 (1 WAK = 1e18 wei)
      tags: tags || [],
      createdAt: createdAt ? new Date(Number(createdAt)) : new Date(),
    status: status || 'open',
    answerCount: 0,
    viewCount: 0,
      githubUrl: githubUrl || '',
    }
    
    console.log('[질문 등록] reward 저장:', {
      원본wei: reward,
      저장값: newQuestion.reward,
      WAK단위: rewardWAK
    })

    const result = await questionsCollection.insertOne(newQuestion)

    // 유저의 질문 수 증가 및 토큰 잔액 차감
    const usersCollection = db.collection('users')
    await usersCollection.updateOne(
      { address: author.toLowerCase() },
      { $inc: { questionCount: 1 } }
    )

    // authUsers 컬렉션에서 토큰 잔액 차감
    const newBalance = Math.max(0, currentBalance - rewardWAK)
    await authUsersCollection.updateOne(
      { email: payload.email },
      { 
        $set: { tokenBalance: newBalance },
        $inc: { questionCount: 1 }
      }
    )

    console.log('[질문 등록] 토큰 잔액 차감 완료:', {
      이전잔액: currentBalance,
      차감금액: rewardWAK,
      새로운잔액: newBalance
    })

    // 관심 태그 알림 생성
    try {
      const rawQuestionTags: string[] = Array.isArray(tags) ? tags : []
      const questionTags = rawQuestionTags
        .map((t: string) => t.trim())
        .filter((t) => t.length > 0)

      if (questionTags.length > 0) {
        // 관심 태그가 겹치는 사용자 조회 (질문 작성자는 제외)
        const candidates = await authUsersCollection
          .find({
            email: { $ne: payload.email },
            interestTags: { $exists: true, $ne: [] },
          })
          .toArray()

        const normalizedQuestionTags = new Set(
          questionTags.map((t) => t.toLowerCase())
        )

        const interestedUsers = candidates.filter((u: any) => {
          const userTags: string[] = Array.isArray(u.interestTags)
            ? u.interestTags
            : []
          const normalizedUserTags = userTags
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
          return normalizedUserTags.some((t) =>
            normalizedQuestionTags.has(t)
          )
        })

        const now = new Date()

        if (interestedUsers.length > 0) {
          const notificationDocs = interestedUsers.map((u: any) => ({
            userEmail: u.email,
            userAddress: u.walletAddress || null,
            type: 'interest-tag-question',
            title: '관심 태그 새 질문',
            message: `관심 태그와 관련된 새 질문이 등록되었습니다: "${title}"`,
            questionId: newQuestion.id,
            tags: questionTags,
            isRead: false,
            createdAt: now,
          }))

          if (notificationDocs.length > 0) {
            await notificationsCollection.insertMany(notificationDocs)
          }
        }
      }
    } catch (notifyError: any) {
      console.error('[질문 등록] 관심 태그 알림 생성 실패 (무시 가능):', notifyError)
    }

    return NextResponse.json({
      success: true,
      question: {
        ...newQuestion,
        _id: result.insertedId,
      },
    })
  } catch (error: any) {
    console.error('질문 등록 실패:', error)
    return NextResponse.json(
      { error: '질문 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 질문 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const author = searchParams.get('author')

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')

    if (id) {
      // 특정 ID의 질문 조회
      try {
        const questionId = id.toString()
        const question = await questionsCollection.findOne({ id: questionId })

        if (!question) {
          console.log(`질문을 찾을 수 없습니다. ID: ${questionId}`)
          return NextResponse.json({ question: null }, { status: 200 })
        }

        // 실제 답변 수 조회
        const answersCollection = db.collection('answers')
        const actualAnswerCount = await answersCollection.countDocuments({
          questionId: questionId,
        })
        
        // DB의 실제 답변 수와 질문의 answerCount가 다르면 업데이트
        if (actualAnswerCount !== (question.answerCount || 0)) {
          await questionsCollection.updateOne(
            { id: questionId },
            { $set: { answerCount: actualAnswerCount } }
          )
        }

        const acceptedAnswerId = question.acceptedAnswerId || null
        console.log('[질문 조회] 질문 ID:', question.id, '채택된 답변 ID:', acceptedAnswerId, '상태:', question.status)
        
        return NextResponse.json({
          question: {
            id: question.id.toString(),
            author: question.author,
            title: question.title,
            content: question.content,
            contentHash: question.contentHash || '',
            reward: (question.reward || 0).toString(),
            tags: question.tags || [],
            createdAt: question.createdAt.getTime().toString(),
            status: question.status || 'open',
            answerCount: actualAnswerCount.toString(), // 실제 답변 수 사용
            githubUrl: question.githubUrl || '',
            acceptedAnswerId: acceptedAnswerId,
            viewCount: (question.viewCount || 0).toString(),
          },
        })
      } catch (queryError: any) {
        console.error('질문 조회 쿼리 실패:', queryError)
        return NextResponse.json(
          { error: `질문 조회 중 오류 발생: ${queryError.message}` },
          { status: 500 }
        )
      }
    } else if (author) {
      // 특정 작성자의 질문 조회
      const questions = (await questionsCollection
        .find({ author: author.toLowerCase() })
        .sort({ createdAt: -1 })
        .toArray()) as WithId<QuestionDocument>[]

      return NextResponse.json({
        questions: questions.map((q) => ({
          id: q.id.toString(),
          author: q.author,
          title: q.title,
          content: q.content,
          contentHash: q.contentHash || '',
          reward: (q.reward || 0).toString(),
          tags: q.tags || [],
          createdAt: q.createdAt.getTime().toString(),
          status: q.status || 'open',
          answerCount: (q.answerCount || 0).toString(),
          githubUrl: q.githubUrl || '',
          viewCount: (q.viewCount || 0).toString(),
        })),
      })
    } else {
      // 모든 질문 조회
      const questions = (await questionsCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray()) as WithId<QuestionDocument>[]

      // 각 질문의 실제 답변 수 조회
      const answersCollection = db.collection('answers')
      const questionsWithAnswerCount = await Promise.all(
        questions.map(async (q) => {
          // DB에서 실제 답변 수 조회
          const actualAnswerCount = await answersCollection.countDocuments({
            questionId: q.id.toString(),
          })
          
          // DB의 실제 답변 수와 질문의 answerCount가 다르면 업데이트
          if (actualAnswerCount !== (q.answerCount || 0)) {
            await questionsCollection.updateOne(
              { id: q.id.toString() },
              { $set: { answerCount: actualAnswerCount } }
            )
          }
          
          return {
            id: q.id.toString(),
            author: q.author,
            title: q.title,
            content: q.content,
            contentHash: q.contentHash || '',
            reward: (q.reward || 0).toString(),
            tags: q.tags || [],
            createdAt: q.createdAt.getTime().toString(),
            status: q.status || 'open',
            answerCount: actualAnswerCount.toString(), // 실제 답변 수 사용
            githubUrl: q.githubUrl || '',
            viewCount: (q.viewCount || 0).toString(),
          }
        })
      )

      return NextResponse.json({
        questions: questionsWithAnswerCount,
      })
    }
  } catch (error: any) {
    console.error('질문 조회 실패:', error)
    return NextResponse.json(
      { error: '질문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 질문 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, answerCount } = body

    if (!id) {
      return NextResponse.json(
        { error: '질문 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')

    const updateData: any = {}
    if (status) updateData.status = status
    if (answerCount !== undefined) updateData.answerCount = answerCount

    const result = await questionsCollection.updateOne(
      { id: id.toString() },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: '질문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('질문 업데이트 실패:', error)
    return NextResponse.json(
      { error: '질문 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 질문 삭제 (작성자 본인만, 채택된 답변이 없는 경우에만 허용)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '질문 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '토큰이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const questionsCollection = db.collection('questions')
    const answersCollection = db.collection('answers')
    const usersCollection = db.collection('users')
    const authUsersCollection = db.collection('authUsers')

    const questionId = id.toString()

    const question = await questionsCollection.findOne({ id: questionId })
    if (!question) {
      return NextResponse.json(
        { error: '질문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 로그인한 사용자의 지갑 주소 확인
    const authUser = await authUsersCollection.findOne({
      email: payload.email,
    })

    const walletAddress = authUser?.walletAddress?.toLowerCase()
    if (!walletAddress) {
      return NextResponse.json(
        { error: '지갑 정보가 없어 질문을 삭제할 수 없습니다.' },
        { status: 403 }
      )
    }

    if ((question.author || '').toLowerCase() !== walletAddress) {
      return NextResponse.json(
        { error: '본인이 작성한 질문만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 채택된 답변이 있는 질문은 삭제 불가
    if (
      question.status === 'solved' ||
      (question.acceptedAnswerId && question.acceptedAnswerId !== '')
    ) {
      return NextResponse.json(
        { error: '채택된 답변이 있는 질문은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 이 질문에 달린 모든 답변 조회 (작성자별 answerCount 감소용)
    const answers = await answersCollection
      .find({ questionId: questionId })
      .toArray()

    const answerCountByAuthor: Record<string, number> = {}
    for (const ans of answers) {
      const author = (ans.author || '').toLowerCase()
      if (!author) continue
      answerCountByAuthor[author] = (answerCountByAuthor[author] || 0) + 1
    }

    // 질문 삭제
    await questionsCollection.deleteOne({ _id: (question as any)._id })

    // 관련 답변 모두 삭제
    if (answers.length > 0) {
      await answersCollection.deleteMany({ questionId: questionId })
    }

    // 질문 수 감소
    await usersCollection.updateOne(
      { address: walletAddress },
      { $inc: { questionCount: -1 } }
    )

    await authUsersCollection.updateOne(
      { email: payload.email },
      { $inc: { questionCount: -1 } }
    )

    // 답변 작성자들의 답변 수 감소
    for (const [author, count] of Object.entries(answerCountByAuthor)) {
      await usersCollection.updateOne(
        { address: author },
        { $inc: { answerCount: -count } }
      )
      await authUsersCollection.updateOne(
        { walletAddress: author },
        { $inc: { answerCount: -count } }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('질문 삭제 실패:', error)
    return NextResponse.json(
      { error: '질문 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

