import { http, Request, Response } from '@google-cloud/functions-framework';
import { db } from './lib/firestore';
import { Timestamp } from '@google-cloud/firestore';

// This function would be triggered by Cloud Scheduler (e.g., every 6 hours)
export const updateDailyStats = http('updateDailyStats', async (req: Request, res: Response) => {
    // Optional: Add a security check if needed (e.g., check for a specific header from Cloud Scheduler)
    // if (!req.headers['x-cloudscheduler'] && process.env.NODE_ENV === 'production') {
    //     console.warn("updateDailyStats: Request missing X-CloudScheduler header.");
    //     return res.status(403).send('Forbidden');
    // }

    console.log("updateDailyStats: Function triggered. Calculating daily stats...");

    try {
        // 1. Total Registered Users
        const usersAggregate = await db.collection('users').count().get();
        const totalUsers = usersAggregate.data().count;

        // 2. Snapshots in the last 24 hours
        const twentyFourHoursAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        
        // This query assumes audit logs are comprehensive for snapshot attempts and success.
        // It might be more robust to query actual snapshot records if they have status and timestamp.
        // For this example, we query audit logs.
        const recentSnapshotsAttemptedQuery = db.collectionGroup('audit')
            .where('type', '==', 'snapshot_created') // Assuming this is logged on attempt/success
            .where('timestamp', '>=', twentyFourHoursAgo)
            .count()
            .get();

        const recentSnapshotsSuccessfulQuery = db.collectionGroup('audit')
            .where('type', '==', 'snapshot_created') // Assuming 'snapshot_created' implies success from M6.1
                                                   // or use a specific detail like details.status === 'success'
            .where('details.status', '==', 'success')                                       
            .where('timestamp', '>=', twentyFourHoursAgo)
            .count()
            .get();
        
        const [attemptedSnapshotData, successfulSnapshotData] = await Promise.all([
            recentSnapshotsAttemptedQuery,
            recentSnapshotsSuccessfulQuery
        ]);

        const totalSnapshotsAttempted24h = attemptedSnapshotData.data().count;
        const totalSnapshotsSuccessful24h = successfulSnapshotData.data().count;
        
        const backupSuccessRate24h = totalSnapshotsAttempted24h > 0 
            ? (totalSnapshotsSuccessful24h / totalSnapshotsAttempted24h) * 100 
            : 100; // Or 0 or NaN if no attempts, handle as preferred

        // 3. Total Snapshots Stored (Proxy for "totalPagesStored" for now)
        // This is a very rough proxy. A better metric would be total actual items/pages.
        // Could query a global snapshot collection if one exists.
        const allSuccessfulSnapshotsQuery = db.collectionGroup('audit')
            .where('type', '==', 'snapshot_created')
            .where('details.status', '==', 'success')
            .count()
            .get();
        const totalSuccessfulSnapshots = (await allSuccessfulSnapshotsQuery).data().count;

        const dailyStats = {
            totalUsers: totalUsers,
            totalSnapshotsAttemptedLast24h: totalSnapshotsAttempted24h,
            totalSnapshotsSuccessfulLast24h: totalSnapshotsSuccessful24h,
            backupSuccessRateLast24h: parseFloat(backupSuccessRate24h.toFixed(2)),
            totalSuccessfulSnapshotsStored: totalSuccessfulSnapshots, // Proxy for pages stored
            lastUpdated: Timestamp.now(),
        };

        await db.collection('stats').doc('daily').set(dailyStats);
        console.log("updateDailyStats: Daily stats updated successfully:", dailyStats);
        res.status(200).send("Daily stats updated successfully.");

    } catch (error) {
        console.error("updateDailyStats: Error updating daily stats:", error);
        res.status(500).send("Error updating daily stats.");
    }
}); 