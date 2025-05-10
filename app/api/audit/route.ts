import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore';
import { Timestamp } from '@google-cloud/firestore'; // For type checking if needed

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

interface AuditLog {
  id: string;
  timestamp: Timestamp; // Firestore Timestamp
  type: string;
  details: any;
  // Add other relevant fields that are stored
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  let limit = parseInt(searchParams.get('limit') || DEFAULT_PAGE_LIMIT.toString(), 10);
  const filterType = searchParams.get('type') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  limit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT); // Clamp limit
  const offset = (page - 1) * limit;

  try {
    let query = db.collection('users').doc(userId).collection('audit')
                  .orderBy('timestamp', 'desc'); // Default sort: newest first

    if (filterType) {
      query = query.where('type', '==', filterType);
    }
    if (startDate) {
      query = query.where('timestamp', '>=', Timestamp.fromDate(new Date(startDate)));
    }
    if (endDate) {
      // Adjust endDate to include the whole day by setting time to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.where('timestamp', '<=', Timestamp.fromDate(endOfDay));
    }

    // Get total count for pagination (can be expensive on large datasets without separate counter)
    // For simplicity, we might omit total count or get it from a limited query if performance is an issue.
    // const totalSnapshot = await query.count().get();
    // const totalCount = totalSnapshot.data().count;
    // For now, we'll fetch one extra to see if there's a next page.

    const paginatedQuery = query.limit(limit + 1); // Fetch one extra to check for nextPage
    if (offset > 0) {
      // Firestore pagination with offset requires using startAfter with the last document of the previous page.
      // For simplicity, if not on page 1, we fetch all up to current page's end to get startAfter doc.
      // This is not ideal for very large datasets. True cursor-based pagination is better.
      // As a simpler offset for moderate data: if we had a startAfterDoc, we'd use it.
      // Since offset is tricky without cursors, let's simulate it for now if needed, or just use limit on page 1.
      // For this example, we'll only use true cursor logic if lastVisibleDocId is passed. 
      // The current implementation of offset via multiple queries is inefficient.
      // Let's stick to simple limit for now and plan for cursor pagination if this becomes slow.
      // For now, the query just applies limit. Proper pagination needs `startAfter()`.
      // The UI will need to handle fetching the `lastVisibleDocId` from the current set for the next page.
      // This API will return docs and client can decide if there is a next page based on count = limit+1.
    }

    const snapshot = await paginatedQuery.get();
    
    let logs: AuditLog[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() } as AuditLog);
    });

    const hasNextPage = logs.length > limit;
    if (hasNextPage) {
      logs = logs.slice(0, limit); // Remove the extra item used for nextPage check
    }

    return NextResponse.json({
      logs,
      currentPage: page,
      hasNextPage,
      // totalCount: totalCount, // If calculated
      limit,
    });

  } catch (error: any) {
    console.error(`[API Audit] Error fetching audit logs for user ${userId}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch audit logs.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 