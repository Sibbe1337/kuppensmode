import * as functions from '@google-cloud/functions-framework';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { Resend } from 'resend';
// Correct import and initialization method
import { createClerkClient } from '@clerk/backend';
import type { Request, Response } from '@google-cloud/functions-framework';
import type { EmailAddress, User } from '@clerk/backend'; // Types likely come from here too

// Initialize Firestore
const db = new Firestore();

// Initialize Resend
const resendApiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;
if (resendApiKey) {
    resend = new Resend(resendApiKey);
    console.log("Resend client initialized.");
} else {
    console.error("RESEND_API_KEY environment variable not set. Email sending disabled.");
}

// Initialize Clerk Backend Client
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
let clerkClient: ReturnType<typeof createClerkClient> | null = null; // Correctly typed client
if (clerkSecretKey) {
    try {
        clerkClient = createClerkClient({ secretKey: clerkSecretKey }); // Correct initialization
        console.log("Clerk backend client created.");
    } catch (clerkError) {
        console.error("Failed to create Clerk client:", clerkError);
    }
} else {
    console.error("CLERK_SECRET_KEY environment variable not set. Cannot fetch user emails.");
}


functions.http('weeklyHealthEmailTrigger', async (req: Request, res: Response) => {
    // Security Check (Example)
    if (!req.headers['x-cloudscheduler'] && process.env.NODE_ENV === 'production') {
        console.warn("Request missing X-CloudScheduler header in production.");
        return res.status(403).send('Forbidden');
    }

    console.log("Starting weekly health email job...");

    if (!resend || !clerkClient) { // Check both are initialized
        console.error("Resend or Clerk client not initialized. Cannot process job.");
        return res.status(500).send('Service configuration error.');
    }

    try {
        const usersSnapshot = await db.collection('users').get();
        console.log(`Found ${usersSnapshot.size} users to process.`);

        let successCount = 0;
        let failureCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            console.log(`Processing user: ${userId}`);

            try {
                // 1. Get User's Email using the instantiated client
                const clerkUser: User = await clerkClient.users.getUser(userId); // Use the initialized client
                const primaryEmailAddress = clerkUser.emailAddresses.find(
                    (email: EmailAddress) => email.id === clerkUser.primaryEmailAddressId // Correct type
                );
                if (!primaryEmailAddress?.emailAddress) {
                    console.warn(`  Skipping user ${userId}: Primary email not found.`);
                    failureCount++;
                    continue;
                }
                const userEmail = primaryEmailAddress.emailAddress;

                // 2. Fetch last week's snapshot data
                const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                let snapshotCountLastWeek = 0;
                try {
                    const snapshotQuery = await db.collection('users').doc(userId)
                                             .collection('snapshots')
                                             .where('timestamp', '>=', oneWeekAgo)
                                             .count()
                                             .get();
                    snapshotCountLastWeek = snapshotQuery.data().count;
                } catch (snapError) {
                     console.warn(`  Could not query snapshot count for user ${userId}:`, snapError);
                }

                console.log(`  Email: ${userEmail}, Snapshots last week: ${snapshotCountLastWeek}`);

                // 3. Construct Email
                const emailHtml = `
                    <p>Hi there,</p>
                    <p>Here's your weekly Notion Lifeline backup summary:</p>
                    <ul><li>Snapshots created in the last 7 days: <strong>${snapshotCountLastWeek}</strong></li></ul>
                    <p>Everything looks good!</p>
                    <p>Visit your <a href="https://pagelifeline.app/dashboard">dashboard</a> to manage your backups.</p>
                    <p><small>Notion Lifeline Team</small></p>
                `;

                // 4. Send Email
                await resend.emails.send({
                    from: 'Notion Lifeline <alerts@pagelifeline.app>', // Use verified domain
                    to: userEmail,
                    subject: 'Your Weekly Notion Backup Summary',
                    html: emailHtml,
                });
                console.log(`  Successfully sent email to ${userEmail}`);
                successCount++;

            } catch (userError: any) {
                 if (userError?.status === 404) {
                     console.warn(`  Skipping user ${userId}: User not found in Clerk.`);
                 } else {
                     console.error(`  Failed processing user ${userId}:`, userError?.message || userError);
                 }
                failureCount++;
            }
        }

        console.log(`Email job completed. Success: ${successCount}, Failures: ${failureCount}`);
        res.status(200).send(`Email job completed. Success: ${successCount}, Failures: ${failureCount}`);

    } catch (error) {
        console.error("Error executing weekly health email job:", error);
        res.status(500).send('Internal Server Error');
    }
});