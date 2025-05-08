"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const functions = __importStar(require("@google-cloud/functions-framework"));
const firestore_1 = require("@google-cloud/firestore");
const resend_1 = require("resend");
// Correct import and initialization method
const backend_1 = require("@clerk/backend");
// Initialize Firestore
const db = new firestore_1.Firestore();
// Initialize Resend
const resendApiKey = process.env.RESEND_API_KEY;
let resend = null;
if (resendApiKey) {
    resend = new resend_1.Resend(resendApiKey);
    console.log("Resend client initialized.");
}
else {
    console.error("RESEND_API_KEY environment variable not set. Email sending disabled.");
}
// Initialize Clerk Backend Client
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
let clerkClient = null; // Correctly typed client
if (clerkSecretKey) {
    try {
        clerkClient = (0, backend_1.createClerkClient)({ secretKey: clerkSecretKey }); // Correct initialization
        console.log("Clerk backend client created.");
    }
    catch (clerkError) {
        console.error("Failed to create Clerk client:", clerkError);
    }
}
else {
    console.error("CLERK_SECRET_KEY environment variable not set. Cannot fetch user emails.");
}
functions.http('weeklyHealthEmailTrigger', async (req, res) => {
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
                const clerkUser = await clerkClient.users.getUser(userId); // Use the initialized client
                const primaryEmailAddress = clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId // Correct type
                );
                if (!primaryEmailAddress?.emailAddress) {
                    console.warn(`  Skipping user ${userId}: Primary email not found.`);
                    failureCount++;
                    continue;
                }
                const userEmail = primaryEmailAddress.emailAddress;
                // 2. Fetch last week's snapshot data
                const oneWeekAgo = firestore_1.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                let snapshotCountLastWeek = 0;
                try {
                    const snapshotQuery = await db.collection('users').doc(userId)
                        .collection('snapshots')
                        .where('timestamp', '>=', oneWeekAgo)
                        .count()
                        .get();
                    snapshotCountLastWeek = snapshotQuery.data().count;
                }
                catch (snapError) {
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
            }
            catch (userError) {
                if (userError?.status === 404) {
                    console.warn(`  Skipping user ${userId}: User not found in Clerk.`);
                }
                else {
                    console.error(`  Failed processing user ${userId}:`, userError?.message || userError);
                }
                failureCount++;
            }
        }
        console.log(`Email job completed. Success: ${successCount}, Failures: ${failureCount}`);
        res.status(200).send(`Email job completed. Success: ${successCount}, Failures: ${failureCount}`);
    }
    catch (error) {
        console.error("Error executing weekly health email job:", error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=index.js.map