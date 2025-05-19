import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/firestore'; // Adjusted path assuming it's in src/lib
import { FieldValue } from '@google-cloud/firestore'; // Needed for serverTimestamp
import { encryptString } from '@/lib/kms'; // Assuming path to kms utility
import type { UserStorageProvider, StorageProviderType } from '@notion-lifeline/common-types'; // For typing
import { decryptString } from '@/lib/kms'; // Ensure this path is correct
import { S3StorageAdapter, R2StorageAdapter } from '@notion-lifeline/storage-adapters'; // Ensure this path is correct

export async function DELETE(
  request: Request,
  { params }: { params: { providerId: string } }
) {
  const db = getDb();
  const { userId } = await auth(); // Use await for auth()

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { providerId } = params;

  if (!providerId) {
    return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
  }

  try {
    const docRef = db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .doc(providerId);

    // Optional: Check if doc exists before delete for more specific feedback, though delete is idempotent.
    // const docSnap = await docRef.get();
    // if (!docSnap.exists) {
    //   return NextResponse.json({ error: "Storage provider configuration not found" }, { status: 404 });
    // }

    await docRef.delete();
    console.log(`[API Storage Delete] Successfully deleted provider ${providerId} for user ${userId}`);
    return NextResponse.json({ message: "Storage provider configuration deleted successfully." }, { status: 200 });
    // Alternatively, return a 204 No Content response:
    // return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error(`[API Storage Delete] Error deleting storage provider ${providerId} for user ${userId}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { providerId: string } }
) {
  const db = getDb();
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { providerId } = params;
  if (!providerId) {
    return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      type,
      bucket,
      region,
      endpoint,
      accessKeyId, // New keys, if provided
      secretAccessKey, // New secret, if provided
      forcePathStyle,
      replicationMode,
      isEnabled
      // adapterVersion and validationStatus are typically not directly editable by user
    } = body;

    const docRef = db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .doc(providerId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Storage provider configuration not found" }, { status: 404 });
    }

    const updateData: Partial<UserStorageProvider> & { updatedAt?: FirebaseFirestore.FieldValue } = {};

    // Only update fields that are actually provided in the request body
    if (type !== undefined && (type === 's3' || type === 'r2')) updateData.type = type as StorageProviderType;
    if (bucket !== undefined) updateData.bucket = bucket;
    if (replicationMode !== undefined) updateData.replicationMode = replicationMode;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (forcePathStyle !== undefined) updateData.forcePathStyle = forcePathStyle;
    
    // Handle type-specific fields
    if (updateData.type === 's3' && region !== undefined) updateData.region = region;
    // If type changed from s3 to r2, or r2 and endpoint provided
    if (updateData.type === 'r2' && endpoint !== undefined) {
        updateData.endpoint = endpoint;
        updateData.region = region || 'auto'; // R2 might have an optional region, or default to auto
    } else if (updateData.type === 's3') {
        // If changing to S3 and endpoint was for R2, clear it unless explicitly provided for S3 custom endpoint
        if (docSnap.data()?.type === 'r2' && endpoint === undefined) {
            updateData.endpoint = FieldValue.delete() as any; // Firestore specific way to delete a field
        }
    }

    // Handle new credentials if provided
    if (accessKeyId && secretAccessKey) {
      console.log(`[API Storage Update] New credentials provided for ${providerId}. Re-encrypting.`);
      updateData.encryptedAccessKeyId = await encryptString(accessKeyId);
      updateData.encryptedSecretAccessKey = await encryptString(secretAccessKey);
      // When credentials change, validation status should reset
      updateData.validationStatus = 'pending';
      updateData.validationError = FieldValue.delete() as any; // Clear previous validation error
    } else if (accessKeyId || secretAccessKey) {
      // Only one part of the key pair was sent - this is an error or incomplete request for new keys
      return NextResponse.json({ error: "Both Access Key ID and Secret Access Key are required to update credentials." }, { status: 400 });
    }

    if (Object.keys(updateData).length === 0 && !(accessKeyId && secretAccessKey)) {
      return NextResponse.json({ message: "No changes provided for update." }, { status: 200 });
    }

    updateData.updatedAt = FieldValue.serverTimestamp(); // Add/update an 'updatedAt' timestamp

    await docRef.update(updateData);
    console.log(`[API Storage Update] Successfully updated provider ${providerId} for user ${userId}`);

    // Fetch the updated document to return it (without encrypted keys)
    const updatedDocSnap = await docRef.get();
    const updatedData = updatedDocSnap.data() as UserStorageProvider;
    const { encryptedAccessKeyId: _, encryptedSecretAccessKey: __, ...safeConfig } = updatedData;

    return NextResponse.json(safeConfig, { status: 200 });

  } catch (error: any) {
    console.error(`[API Storage Update] Error updating storage provider ${providerId} for user ${userId}:`, error);
    if (error instanceof Error && error.message.includes("KMS_KEY_NAME")){
        return NextResponse.json({ error: "Server configuration error for encryption service."}, { status: 500 });
    }
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request, // Changed from PUT to POST for validation action, as it triggers a process
  { params }: { params: { providerId: string } }
) {
  const db = getDb();
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { providerId } = params;
  if (!providerId) {
    return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
  }

  const docRef = db
    .collection('userStorageConfigs')
    .doc(userId)
    .collection('providers')
    .doc(providerId);

  let validationStatus: UserStorageProvider['validationStatus'] = 'error';
  let validationError: string | null = "Unknown validation error.";

  try {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Storage provider configuration not found" }, { status: 404 });
    }

    const config = docSnap.data() as UserStorageProvider;

    if (!config.encryptedAccessKeyId || !config.encryptedSecretAccessKey) {
        throw new Error("Stored credentials are incomplete or missing.");
    }

    const accessKeyId = await decryptString(config.encryptedAccessKeyId);
    const secretAccessKey = await decryptString(config.encryptedSecretAccessKey);

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Decrypted credentials are empty.");
    }

    let testAdapter;
    console.log(`[API Storage Validate] Validating ${config.type} provider: ${config.bucket}`);

    if (config.type === 's3') {
      if (!config.region) throw new Error("Region is required for S3 validation.");
      testAdapter = new S3StorageAdapter({
        bucket: config.bucket,
        region: config.region,
        accessKeyId,
        secretAccessKey,
        forcePathStyle: config.forcePathStyle,
      });
    } else if (config.type === 'r2') {
      if (!config.endpoint) throw new Error("Endpoint is required for R2 validation.");
      testAdapter = new R2StorageAdapter({
        bucket: config.bucket,
        endpoint: config.endpoint,
        accessKeyId,
        secretAccessKey,
        forcePathStyle: config.forcePathStyle,
        region: config.region || 'auto',
      });
    } else {
      throw new Error(`Unsupported provider type for validation: ${config.type}`);
    }

    await testAdapter.list(''); // Test by listing root
    
    validationStatus = 'success';
    validationError = null;
    console.log(`[API Storage Validate] Validation successful for ${providerId}`);

  } catch (err: any) {
    console.error(`[API Storage Validate] Validation failed for ${providerId}:`, err);
    validationStatus = 'error';
    validationError = err.message || "Validation failed due to an unknown error.";
    await docRef.update({
      validationStatus: 'error',
      validationError: validationError,
      lastValidatedAt: FieldValue.serverTimestamp(),
    }).catch(updateErr => console.error(`[API Storage Validate] Failed to update Firestore with error status for ${providerId}:`, updateErr));
    return NextResponse.json({ success: false, validationStatus, error: validationError }, { status: 400 });
  }

  await docRef.update({
    validationStatus: 'success',
    validationError: FieldValue.delete(),
    lastValidatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, validationStatus: 'success' });
} 