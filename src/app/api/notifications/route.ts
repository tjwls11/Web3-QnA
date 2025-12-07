import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

// GET /api/notifications - 현재 사용자 알림 조회 (미읽음, 최근 N일)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ notifications: [] }, { status: 200 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ notifications: [] }, { status: 200 })
    }

    const client = await clientPromise
    const db = client.db('wakqna')
    const notificationsCollection = db.collection('notifications')

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 오래된 읽은 알림은 정리
    try {
      await notificationsCollection.deleteMany({
        userEmail: payload.email,
        isRead: true,
        createdAt: { $lt: sevenDaysAgo },
      })
    } catch (cleanupError) {
      console.warn(
        '[알림] 오래된 읽은 알림 정리 실패(무시 가능):',
        cleanupError
      )
    }

    // 최근 7일 이내 + 미읽음 알림만 조회
    const notifications = await notificationsCollection
      .find({
        userEmail: payload.email,
        isRead: { $ne: true },
        createdAt: { $gte: sevenDaysAgo },
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type || 'info',
        title: n.title || '',
        message: n.message || '',
        questionId: n.questionId || null,
        tags: n.tags || [],
        createdAt: n.createdAt?.getTime?.() || Date.now(),
      })),
    })
  } catch (error: any) {
    console.error('[알림] 조회 실패:', error)
    return NextResponse.json({ notifications: [] }, { status: 200 })
  }
}

// PATCH /api/notifications - 현재 사용자 알림 읽음 처리
export async function PATCH(request: NextRequest) {
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

    const client = await clientPromise
    const db = client.db('wakqna')
    const notificationsCollection = db.collection('notifications')

    const now = new Date()

    await notificationsCollection.updateMany(
      {
        userEmail: payload.email,
        isRead: { $ne: true },
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[알림] 읽음 처리 실패:', error)
    return NextResponse.json(
      { error: '알림 읽음 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
