import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Optional: load credentials from env-vars or a JSON file
/* const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY_JSON!); */

initializeApp({
  // credential: cert(serviceAccount as ServiceAccount),      // ← uncomment if you need it
});

export const db = getFirestore(); 