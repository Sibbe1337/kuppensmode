import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore';

export const runtime = 'nodejs';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  link?: string;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  console.log(`[API Notifications] Fetching ${unreadOnly ? 'unread' : 'all'} notifications for user: ${userId}`);

  try {
    // TODO: Implement actual Firestore query to fetch notifications for the user
    // e.g., db.collection('users').doc(userId).collection('notifications').orderBy('timestamp', 'desc').limit(20).get();
    // Filter by isRead if unreadOnly is true.

    // Mock data for now:
    const mockNotifications: Notification[] = [
      {
        id: 'notif1', type: 'success', message: 'Snapshot "July Week 3" completed successfully.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), isRead: false,
        link: '/dashboard?snapshot=july_w3'
      },
      {
        id: 'notif2', type: 'info', message: 'Your new "Pro Plan" subscription is now active.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), isRead: false,
        link: '/dashboard/settings?tab=billing'
      },
      {
        id: 'notif3', type: 'warning', message: 'Low snapshot quota remaining. Consider upgrading.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), isRead: true,
        link: '/pricing'
      },
    ];

    const notificationsToReturn = unreadOnly 
      ? mockNotifications.filter(n => !n.isRead)
      : mockNotifications;

    return NextResponse.json({ notifications: notificationsToReturn, unreadCount: mockNotifications.filter(n => !n.isRead).length });

  } catch (error: any) {
    console.error("[API Notifications] Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications.", details: error.message }, { status: 500 });
  }
}

// TODO: Add POST route to mark notifications as read?
// export async function POST(request: Request) { ... } 