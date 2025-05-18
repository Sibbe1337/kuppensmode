import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '../../../../../src/lib/firestore'; // Corrected path and import
import { decryptString } from '@shared/kms';
import type { UserStorageProvider } from '../../../../../src/types/storageProvider'; // Corrected path
import { FieldValue } from '@shared/firestore';

const db = getDb(); // Initialize db instance

interface RouteContext {
  params: {
    id: string; // This is the providerConfigId
  };
}

// PUT /api/user/storage-configs/[id] - Update a specific storage provider configuration
export async function PUT(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  const { id: providerConfigId } = params;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!providerConfigId) {
    return new NextResponse("Missing provider configuration ID", { status: 400 });
  }

  try {
    const body = await request.json();
    // Only allow updating specific fields, e.g., isEnabled, bucket, region, endpoint, replicationMode
    // Keys (accessKeyId, secretAccessKey) should NOT be updatable via PUT for security.
    // If keys need to change, the user should delete and re-add the configuration.
    const { 
      bucket,
      region,
      endpoint,
      forcePathStyle,
      isEnabled,
      replicationMode,
      // We explicitly DO NOT allow encryptedAccessKeyId or encryptedSecretAccessKey to be updated here.
    } = body;

    const updateData: Partial<UserStorageProvider> & { lastValidatedAt?: FieldValue, updatedAt?: FieldValue } = {};

    if (bucket !== undefined) updateData.bucket = bucket;
    if (region !== undefined) updateData.region = region;
    if (endpoint !== undefined) updateData.endpoint = endpoint;
    if (forcePathStyle !== undefined) updateData.forcePathStyle = forcePathStyle;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (replicationMode !== undefined) updateData.replicationMode = replicationMode;
    
    // If any updatable field is present, add/update an 'updatedAt' timestamp
    if (Object.keys(updateData).length > 0) {
      // No, lastValidatedAt is only for validation. Let's add updatedAt.
      // updateData.lastValidatedAt = FieldValue.serverTimestamp(); // Incorrect field for general update
    }
    // It might be better to add an `updatedAt` field to UserStorageProvider type for this.
    // For now, we'll just update the fields provided.

    if (Object.keys(updateData).length === 0) {
      return new NextResponse("No updatable fields provided", { status: 400 });
    }

    const docRef = db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .doc(providerConfigId);

    await docRef.update(updateData);

    // Fetch and return the updated document, redacting sensitive fields
    const updatedDoc = await docRef.get();
    if (!updatedDoc.exists) {
      return new NextResponse("Provider configuration not found after update", { status: 404 });
    }
    const updatedData = updatedDoc.data() as UserStorageProvider;
    const { encryptedAccessKeyId: _, encryptedSecretAccessKey: __, ...safeConfig } = updatedData;

    return NextResponse.json(safeConfig);

  } catch (error) {
    console.error(`Error updating storage provider config ${providerConfigId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/user/storage-configs/[id] - Delete a specific storage provider configuration
export async function DELETE(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  const { id: providerConfigId } = params;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!providerConfigId) {
    return new NextResponse("Missing provider configuration ID", { status: 400 });
  }

  try {
    const docRef = db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .doc(providerConfigId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return new NextResponse("Provider configuration not found", { status: 404 });
    }

    await docRef.delete();

    return new NextResponse(null, { status: 204 }); // No content, success

  } catch (error) {
    console.error(`Error deleting storage provider config ${providerConfigId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 