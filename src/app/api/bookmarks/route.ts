import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { Bookmark } from '@/lib/contracts/types'

interface BookmarkDocument {
  questionId: string
  userAddress: string
  createdAt: Date
}

// 찜하기 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, userAddress } = body

    if (!questionId || !userAddress) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const bookmarksCollection = db.collection<BookmarkDocument>('bookmarks')

    // 이미 찜한 경우 확인
    const existing = await bookmarksCollection.findOne({
      questionId: questionId.toString(),
      userAddress: userAddress.toLowerCase(),
    })

    if (existing) {
      return NextResponse.json({ success: true, message: '이미 찜한 질문입니다.' })
    }

    const bookmark: BookmarkDocument = {
      questionId: questionId.toString(),
      userAddress: userAddress.toLowerCase(),
      createdAt: new Date(),
    }

    await bookmarksCollection.insertOne(bookmark)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('찜하기 추가 실패:', error)
    return NextResponse.json(
      { error: '찜하기 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 찜하기 제거
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')
    const userAddress = searchParams.get('userAddress')

    if (!questionId || !userAddress) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const bookmarksCollection = db.collection<BookmarkDocument>('bookmarks')

    await bookmarksCollection.deleteOne({
      questionId: questionId.toString(),
      userAddress: userAddress.toLowerCase(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('찜하기 제거 실패:', error)
    return NextResponse.json(
      { error: '찜하기 제거에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 찜 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const bookmarksCollection = db.collection<BookmarkDocument>('bookmarks')
    const questionsCollection = db.collection('questions')

    // 사용자의 찜 목록 조회
    const bookmarks = await bookmarksCollection
      .find({ userAddress: userAddress.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray()

    // 질문 정보 가져오기
    const bookmarkedQuestions = await Promise.all(
      bookmarks.map(async (bookmark) => {
        // id가 문자열 또는 숫자일 수 있으므로 둘 다 시도
        let question = await questionsCollection.findOne({
          id: bookmark.questionId,
        })
        
        // 문자열로 찾지 못하면 숫자로도 시도
        if (!question) {
          const questionIdNum = parseInt(bookmark.questionId, 10)
          if (!isNaN(questionIdNum)) {
            question = await questionsCollection.findOne({
              id: questionIdNum,
            })
          }
        }
        
        // 숫자 문자열로도 시도
        if (!question) {
          question = await questionsCollection.findOne({
            id: bookmark.questionId.toString(),
          })
        }
        
        if (!question) {
          console.log('[찜 목록] 질문을 찾을 수 없음:', bookmark.questionId)
          return null
        }

        return {
          id: question.id.toString(),
          author: question.author,
          title: question.title,
          content: question.content || '',
          contentHash: question.contentHash || '',
          reward: (question.reward || 0).toString(),
          tags: question.tags || [],
          createdAt: question.createdAt.getTime().toString(),
          status: question.status || 'open',
          answerCount: (question.answerCount || 0).toString(),
        }
      })
    )

    return NextResponse.json({
      questions: bookmarkedQuestions.filter((q) => q !== null),
    })
  } catch (error: any) {
    console.error('찜 목록 조회 실패:', error)
    return NextResponse.json(
      { error: '찜 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}


