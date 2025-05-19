// Stub for apps/web/src/lib/firestore.ts
export const getDb = () => {
  console.warn("STUB: getDb() called. Implement real firestore connection.");
  return null; // Or a mock Firestore instance if needed
};

export const FieldValue = {
  serverTimestamp: () => new Date(),
  // Add other FieldValue stubs if used, e.g., arrayUnion, delete, etc.
};

console.log('[Firestore Lib STUB] Firestore module loaded.'); 