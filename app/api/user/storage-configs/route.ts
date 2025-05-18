import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '../../../../src/lib/firestore'; // Import the getter
import { encryptString } from '@shared/kms';
import type { UserStorageProvider, StorageProviderType } from '../../../../src/types/storageProvider';
import { nanoid } from 'nanoid';
// Import types from @google-cloud/firestore since firebase-admin is not a direct dependency
import { Timestamp, FieldValue, type QueryDocumentSnapshot } from '@shared/firestore';

const db = getDb(); // Initialize db instance

// POST /api/user/storage-configs - Create a new storage provider configuration
export async function POST(request: Request) {
  const { userId } = await auth(); // Explicitly await auth() to satisfy linter
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      type,
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      forcePathStyle,
      replicationMode = 'mirror',
      adapterVersion = 1,
    } = body;

    if (!type || !bucket || !accessKeyId || !secretAccessKey) {
      return new NextResponse("Missing required fields (type, bucket, accessKeyId, secretAccessKey)", { status: 400 });
    }
    if (type === 'r2' && !endpoint) {
      return new NextResponse("Endpoint is required for R2 type", { status: 400 });
    }

    const encryptedAccessKeyId = await encryptString(accessKeyId);
    const encryptedSecretAccessKey = await encryptString(secretAccessKey);

    // Ensure UserStorageProvider uses FirebaseFirestore.Timestamp if that's what @google-cloud/firestore provides
    // For FieldValue.serverTimestamp(), the field in the interface should be prepared for a server timestamp
    const newProviderConfigData: Omit<UserStorageProvider, 'createdAt' | 'lastValidatedAt'> & { createdAt: FirebaseFirestore.FieldValue; lastValidatedAt?: FirebaseFirestore.FieldValue } = {
      id: nanoid(),
      type: type as StorageProviderType,
      bucket,
      region: region || undefined,
      endpoint: endpoint || undefined,
      encryptedAccessKeyId,
      encryptedSecretAccessKey,
      forcePathStyle: forcePathStyle === undefined ? (type === 'r2') : forcePathStyle, 
      isEnabled: true, 
      replicationMode: replicationMode as 'mirror' | 'archive',
      adapterVersion,
      validationStatus: 'pending',
      createdAt: FieldValue.serverTimestamp(), 
    };

    const docRef = db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .doc(newProviderConfigData.id);
      
    await docRef.set(newProviderConfigData);

    const savedDoc = await docRef.get();
    // Cast to UserStorageProvider which should expect Timestamp for createdAt/lastValidatedAt after read
    const savedData = savedDoc.data() as UserStorageProvider; 

    const { encryptedAccessKeyId: _, encryptedSecretAccessKey: __, ...safeConfig } = savedData;
    return NextResponse.json(safeConfig, { status: 201 });

  } catch (error) {
    console.error("Error creating storage provider config:", error);
    if (error instanceof Error && error.message.includes("KMS_KEY_NAME")){
        return new NextResponse("Server configuration error for encryption service.", { status: 500 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// GET /api/user/storage-configs - List storage provider configurations for the user
export async function GET(request: Request) {
  const { userId } = await auth(); // Explicitly await auth() to satisfy linter
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const providersSnapshot = await db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .orderBy('createdAt', 'desc')
      .get();

    const providers: Partial<UserStorageProvider>[] = [];
    providersSnapshot.forEach(doc => {
      const data = doc.data() as UserStorageProvider;
      const { encryptedAccessKeyId, encryptedSecretAccessKey, ...safeData } = data;
      providers.push(safeData);
    });

    return NextResponse.json(providers);

  } catch (error) {
    console.error("Error fetching storage provider configs:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 