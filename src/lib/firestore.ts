import { createFirestore, FieldValue, Timestamp, type Firestore } from '@shared/firestore';

let dbInstance: Firestore | null = null;

function getDbInstance(): Firestore {
  if (!dbInstance) {
    dbInstance = createFirestore();
    console.log('[Firestore Lib] Shared Firestore instance created.');
  }
  return dbInstance;
}

// Export a getter for the db instance
export const getDb = () => getDbInstance();

// Export helpers and types
export { FieldValue, Timestamp };

console.log('[Firestore Lib] Firestore module loaded (instance will be initialized on first use).'); 