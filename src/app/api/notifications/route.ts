import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifyToken } from '@/lib/jwt'

// GET /api/notifications - 현재 사용자 알림 조회 (미읽음)
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

    const notifications = await notificationsCollection
      .find({
        userEmail: payload.email,
        isRead: { $ne: true },
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



