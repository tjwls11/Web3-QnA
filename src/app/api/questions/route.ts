import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { Document, WithId } from 'mongodb'

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
}

// 질문 등록
export async function POST(request: NextRequest) {
  try {
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

    // 질문 ID가 없으면 생성
    const questionId = id || Date.now()

    const newQuestion = {
      id: questionId.toString(),
      author: author.toLowerCase(),
      title,
      content,
      contentHash: contentHash || '',
      reward: reward ? Number(reward) : 0,
      tags: tags || [],
      createdAt: createdAt ? new Date(Number(createdAt)) : new Date(),
      status: status || 'open',
      answerCount: 0,
      githubUrl: githubUrl || '',
    }

    const result = await questionsCollection.insertOne(newQuestion)

    // 유저의 질문 수 증가
    const usersCollection = db.collection('users')
    await usersCollection.updateOne(
      { address: author.toLowerCase() },
      { $inc: { questionCount: 1 } }
    )

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
            answerCount: (question.answerCount || 0).toString(),
            githubUrl: question.githubUrl || '',
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
        })),
      })
    } else {
      // 모든 질문 조회
      const questions = (await questionsCollection
        .find({})
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
        })),
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
