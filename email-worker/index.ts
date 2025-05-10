import * as functions from '@google-cloud/functions-framework';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { Resend } from 'resend';
// Correct import and initialization method
import { createClerkClient } from '@clerk/backend';
import type { Request, Response } from '@google-cloud/functions-framework';
import type { EmailAddress, User } from '@clerk/backend'; // Types likely come from here too
import type { CloudEvent } from '@google-cloud/functions-framework'; // For Pub/Sub trigger

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

// Define Pub/Sub message structure for email requests
interface EmailJobPayload {
    userId: string;
    emailType: 'snapshot_running' | 'snapshot_completed_with_diff' | 'day7_pitch_email' | 'trial_ending_soon' | 'welcome_day_7_pitch'; // Add more types as needed
    data: any; // Type-specific data
}
interface PubSubEmailMessage {
    data: string; // Base64 encoded EmailJobPayload
}
interface PubSubCloudEventEmailData {
    message: PubSubEmailMessage;
}

functions.http('weeklyHealthEmailTrigger', async (req: Request, res: Response) => {
    // Security Check (Example) - REMOVED as per A3. Rely on IAM for authentication.
    // if (!req.headers['x-cloudscheduler'] && process.env.NODE_ENV === 'production') {
    //     console.warn("Request missing X-CloudScheduler header in production.");
    //     return res.status(403).send('Forbidden');
    // }

    console.log("Starting weekly health email job...");
    const runId = `run-${Date.now()}`;
    const emailRunLogRef = db.collection('analytics').doc('emailRuns').collection('runs').doc(runId);

    if (!resend || !clerkClient) { // Check both are initialized
        console.error("Resend or Clerk client not initialized. Cannot process job.");
        // Log failure to analytics
        try {
            await emailRunLogRef.set({
                timestamp: Timestamp.now(),
                status: 'failed_to_start',
                reason: 'Resend or Clerk client not initialized',
                successCount: 0,
                failureCount: 0
            });
        } catch (logError) {
            console.error("Failed to log start failure to analytics:", logError);
        }
        return res.status(500).send('Service configuration error.');
    }

    let overallStatus: 'completed' | 'completed_with_errors' | 'failed' = 'completed';
    let usersSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null = null;

    try {
        usersSnapshot = await db.collection('users').get();
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
        
        if (failureCount > 0 && successCount > 0) overallStatus = 'completed_with_errors';
        else if (failureCount > 0 && successCount === 0) overallStatus = 'failed';

        // Log success/failure to analytics
        try {
            await emailRunLogRef.set({
                timestamp: Timestamp.now(),
                status: overallStatus,
                successCount: successCount,
                failureCount: failureCount
            });
            console.log(`Logged email run ${runId} to analytics.`);
        } catch (logError) {
            console.error("Failed to log results to analytics:", logError);
        }

        res.status(200).send(`Email job completed. Success: ${successCount}, Failures: ${failureCount}`);

    } catch (error: any) {
        console.error("Error executing weekly health email job:", error);
        // Log critical failure to analytics
        try {
            await emailRunLogRef.set({
                timestamp: Timestamp.now(),
                status: 'failed',
                reason: error?.message || 'Unknown error executing job',
                successCount: 0,
                failureCount: usersSnapshot ? usersSnapshot.size : 0
            });
        } catch (logError) {
            console.error("Failed to log critical failure to analytics:", logError);
        }
        res.status(500).send('Internal Server Error');
    }
});

// --- B.1.3: New Pub/Sub trigger for transactional emails ---
functions.cloudEvent('transactionalEmailProcessor', async (cloudEvent: CloudEvent<PubSubCloudEventEmailData>) => {
    console.log("transactionalEmailProcessor: Received event:", cloudEvent.id);

    if (!cloudEvent.data?.message?.data) {
        console.error('Invalid Pub/Sub message format: Missing data.message.data');
        return; // ACK the message to prevent retries for malformed ones
    }

    let jobPayload: EmailJobPayload;
    try {
        const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf8');
        jobPayload = JSON.parse(messageData) as EmailJobPayload;
        console.log("Parsed job payload:", jobPayload);
    } catch (err) {
        console.error('Failed to parse Pub/Sub message data:', err);
        return; // ACK malformed message
    }

    const { userId, emailType, data } = jobPayload;

    if (!resend || !clerkClient) {
        console.error(`Cannot process email for user ${userId}, type ${emailType}: Resend or Clerk client not initialized.`);
        // Optionally, could re-queue or log to a dead-letter topic if this is transient
        return; // ACK message, as retrying won't help if clients aren't init
    }

    try {
        const clerkUser: User = await clerkClient.users.getUser(userId);
        const primaryEmailAddress = clerkUser.emailAddresses.find(
            (email: EmailAddress) => email.id === clerkUser.primaryEmailAddressId
        );
        if (!primaryEmailAddress?.emailAddress) {
            console.warn(`Skipping email for user ${userId}, type ${emailType}: Primary email not found.`);
            return;
        }
        const userEmail = primaryEmailAddress.emailAddress;
        const userName = clerkUser.firstName || clerkUser.username || 'there';

        let emailSubject = '';
        let emailHtml = '';

        switch (emailType) {
            case 'snapshot_running':
                emailSubject = 'Your Notion Backup is Running!';
                emailHtml = `
                    <p>Hi ${userName},</p>
                    <p>Just letting you know that your scheduled (or manually triggered) Notion backup (ID: ${data.snapshotId || 'N/A'}) has started.</p>
                    <p>We'll notify you once it's complete. You can view progress on your <a href="${data.dashboardUrl || 'https://pagelifeline.app/dashboard'}">dashboard</a>.</p>
                    <p>Thanks,<br/>The Pagelifeline Team</p>
                `;
                break;
            case 'snapshot_completed_with_diff':
                emailSubject = 'Your First Pagelifeline Snapshot Summary!';
                const diff = data.diffSummary || { added: 0, removed: 0, changed: 0 };
                const hasChanges = diff.added > 0 || diff.removed > 0 || diff.changed > 0;
                emailHtml = `
                    <p>Hi ${userName},</p>
                    <p>Your first Notion backup with Pagelifeline (ID: ${data.snapshotId || 'N/A'}) completed successfully!</p>
                    ${hasChanges ? 
                        `<p>Here's a quick look at what changed since the workspace was last in this state (if applicable):</p>
                        <ul>
                            <li><strong>New items:</strong> ${diff.added}</li>
                            <li><strong>Changed items:</strong> ${diff.changed}</li>
                            <li><strong>Removed items:</strong> ${diff.removed}</li>
                        </ul>
                        <p>You can explore your snapshots and restore data anytime from your <a href="${data.dashboardUrl || 'https://pagelifeline.app/dashboard'}">dashboard</a>.</p>` 
                    : 
                        `<p>We've successfully backed up your workspace. No significant changes were detected compared to an empty state (as this is your first snapshot), or no previous comparable snapshot was found.</p>
                        <p>Visit your <a href="${data.dashboardUrl || 'https://pagelifeline.app/dashboard'}">dashboard</a> to view your snapshot.</p>`
                    }
                    <p>Happy with your first backup? Consider exploring our features for even more peace of mind!</p>
                    <p>Thanks,<br/>The Pagelifeline Team</p>
                `;
                break;
            case 'day7_pitch_email': // B.1: New email type for Day 7 Pitch
                emailSubject = 'Unlock More Power with Pagelifeline Pro!';
                // Assuming data might contain { userName, pricingPageUrl, dashboardUrl }
                // userName is already fetched above in the worker
                const pricingPageUrl = data.pricingPageUrl || 'https://pagelifeline.app/pricing';
                const dashboardUrl = data.dashboardUrl || 'https://pagelifeline.app/dashboard';

                emailHtml = `
                    <p>Hi ${userName},</p>
                    <p>It's been about a week since you started using Pagelifeline to back up your Notion workspace. We hope you're finding it valuable!</p>
                    <p>Did you know our Pro plan offers even more to keep your Notion data safe and accessible?</p>
                    <ul>
                        <li><strong>More Snapshots:</strong> Increased limits for your peace of mind.</li>
                        <li><strong>Advanced Restore Options:</strong> Greater flexibility when you need to recover data.</li>
                        <li><strong>Priority Support:</strong> Get help faster when you need it.</li>
                        <li><em>And more features coming soon!</em></li>
                    </ul>
                    <p>Secure your workspace comprehensively and unlock all features by upgrading today:</p>
                    <p><a href="${pricingPageUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Upgrade to Pro</a></p>
                    <p>If you have any questions, don't hesitate to visit your <a href="${dashboardUrl}">dashboard</a> or reach out to our support.</p>
                    <p>Best,<br/>The Pagelifeline Team</p>
                `;
                break;
            // TODO: Add cases for other email types (Day 1 diff, Day 7 pitch, Day 14 trial)
            // case 'snapshot_completed_with_diff':
            //   emailSubject = 'Your Notion Backup is Complete - See What Changed!';
            //   emailHtml = // ... construct HTML with diff summary/link ...
            //   break;
            default:
                console.warn(`Unknown emailType: ${emailType} for user ${userId}.`);
                return; // ACK message
        }

        await resend.emails.send({
            from: 'Pagelifeline Updates <updates@pagelifeline.app>', // Use a generic updates sender
            to: userEmail,
            subject: emailSubject,
            html: emailHtml,
        });
        console.log(`Successfully sent '${emailType}' email to ${userEmail} for user ${userId}.`);

        // TODO: Log this email send to analytics/emailRuns if needed, similar to weekly health email

    } catch (error: any) {
        if (error?.status === 404 && error?.message?.includes('could not find the user')) {
            console.warn(`User ${userId} not found in Clerk when trying to send '${emailType}'. Skipping.`);
        } else {
            console.error(`Failed to send '${emailType}' email to user ${userId}:`, error?.message || error);
        }
        // Decide on retry strategy. For now, ACK to avoid infinite loops on persistent errors.
    }
});

// --- Make sure the existing weeklyHealthEmailTrigger is still exported if it was top-level ---
// Re-paste or ensure it's correctly structured with the new Pub/Sub function
// If weeklyHealthEmailTrigger was the only export, and now you have two, adjust exports if necessary
// For Google Cloud Functions, typically each exported function is a separate trigger.
// The import * as functions from '@google-cloud/functions-framework';
// and then functions.http(...) / functions.cloudEvent(...) handles registration.