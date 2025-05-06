// test-firestore-write.js
const { Firestore } = require('@google-cloud/firestore');

async function testWrite() {
  try {
    // These should match your .env.local and the JSON key file
    const projectId = 'notion-lifeline';
    const keyFilename = '/Users/emilsoujeh/Downloads/notion-lifeline-2605d6859267.json'; // ABSOLUTE PATH

    console.log(`Attempting to connect to Firestore project: ${projectId} using keyfile: ${keyFilename}`);

    const db = new Firestore({
      projectId: projectId,
      keyFilename: keyFilename,
    });

    const testUserId = `test-user-${Date.now()}`;
    const docRef = db.collection('test_writes').doc(testUserId);

    console.log(`Attempting to write to: ${docRef.path}`);
    await docRef.set({
      message: 'Hello from test script!',
      timestamp: Firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Successfully wrote to ${docRef.path}! Document ID: ${testUserId}`);

    console.log(`Attempting to read from ${docRef.path}`);
    const snap = await docRef.get();
    if (snap.exists) {
      console.log('Read back data:', snap.data());
    } else {
      console.error('Failed to read back document, it does not exist.');
    }

  } catch (error) {
    console.error('Error during Firestore test script:', error);
    if (error.code === 5) {
        console.error('This is a NOT_FOUND error (gRPC code 5).');
    }
    if (error.code === 7) {
        console.error('This is a PERMISSION_DENIED error (gRPC code 7).');
    }
  }
}

testWrite();