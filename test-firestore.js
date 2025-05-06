    // test-firestore.js
    const path = require('path');

    // Set the environment variable for the project ID explicitly for the script
    // (This ensures it uses the same value as your .env.local)
    process.env.GOOGLE_CLOUD_PROJECT = 'notion-lifeline';
    // Point to the compiled JS output of your firestore.ts
    // Adjust the path if your compiled output goes somewhere else or if ts-node is setup
    // Assuming standard Next.js build output might not place it predictably here,
    // let's try importing the TS source directly if possible using a loader,
    // or fall back to re-initializing. For simplicity, let's re-initialize here.

    const { Firestore, FieldValue } = require('@google-cloud/firestore');

    console.log(`[Test Script] Initializing Firestore for project: ${process.env.GOOGLE_CLOUD_PROJECT}`);

    let db;
    try {
        db = new Firestore({
            ignoreUndefinedProperties: true,
            // projectId: process.env.GOOGLE_CLOUD_PROJECT // Should be picked up automatically now
        });
        console.log('[Test Script] Firestore client initialized.');
    } catch (initError) {
        console.error('[Test Script] Failed to initialize Firestore:', initError);
        process.exit(1);
    }

    const testUserId = 'user_2wgqapQFxV0H8p7PfWR0aLzaQFV'; // Use the same user ID

    async function runTest() {
        if (!db) {
            console.error('[Test Script] DB not initialized.');
            return;
        }
        console.log(`[Test Script] Attempting Firestore set({ merge: true }) for userId: '${testUserId}'`);
        try {
            const docRef = db.collection('users').doc(testUserId);
            await docRef.set({
                lastTestWrite: FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`[Test Script] SUCCESS: Wrote test field for user ${testUserId}`);

            // Optional: Read the document back to verify
            // const docSnap = await docRef.get();
            // if (docSnap.exists) {
            //    console.log("[Test Script] Document data:", docSnap.data());
            //} else {
            //    console.log("[Test Script] Document read back failed (doesn't exist?)");
            //}

        } catch (error) {
            console.error(`[Test Script] FAILED: Firestore operation error:`, error);
        }
    }

    runTest();