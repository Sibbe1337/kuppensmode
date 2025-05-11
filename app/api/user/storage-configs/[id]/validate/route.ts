import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firebaseAdmin'; // Assuming this path alias resolves
import { decryptString } from '@/lib/kms'; // Assuming this path alias resolves
import type { UserStorageProvider } from '@/types/storageProvider'; // Assuming this path alias resolves
import { S3StorageAdapter } from '@/storage/S3StorageAdapter'; // Assuming this path alias resolves
import { R2StorageAdapter } from '@/storage/R2StorageAdapter'; // Assuming this path alias resolves
import { FieldValue } from '@google-cloud/firestore';
import { randomUUID } from 'crypto'; // Using crypto.randomUUID for modern Node.js

interface RouteContext {
  params: {
    id: string; // This is the providerConfigId (UserStorageProvider.id)
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  const { id: providerConfigId } = params;

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!providerConfigId) {
    return new NextResponse("Missing provider configuration ID", { status: 400 });
  }

  const cfgRef = db
    .collection('userStorageConfigs')
    .doc(userId)
    .collection('providers')
    .doc(providerConfigId);

  try {
    const cfgSnap = await cfgRef.get();
    if (!cfgSnap.exists) {
      return new NextResponse('Provider configuration not found', { status: 404 });
    }
    const cfg = cfgSnap.data() as UserStorageProvider;

    // Mark as pending before starting actual validation
    await cfgRef.update({
      validationStatus: 'pending',
      validationError: FieldValue.delete(), // Clear previous error
      lastValidatedAt: FieldValue.serverTimestamp(),
    });

    const accessKeyId = await decryptString(cfg.encryptedAccessKeyId);
    const secretAccessKey = await decryptString(cfg.encryptedSecretAccessKey);

    let adapter;
    if (cfg.type === 's3') {
      adapter = new S3StorageAdapter({
        bucket: cfg.bucket,
        region: cfg.region, // S3StorageAdapter constructor expects region for S3Client
        // S3StorageAdapter will need to be modified or S3Client configured directly if passing credentials
        // For now, assuming S3StorageAdapter picks up AWS_PROFILE or default credentials from environment for the client
        // If direct credential passing is needed for S3, S3StorageAdapter constructor must accept them like R2Adapter does.
        // For this validation, we *must* use the decrypted keys.
        // This means S3StorageAdapter needs an option for credentials like R2StorageAdapter.
        // Temporary direct client instantiation for S3 to use decrypted keys:
        // Let's assume S3StorageAdapter and R2StorageAdapter can accept credentials in constructor
        // This requires S3StorageAdapter to be updated to accept explicit credentials.
        // For now, this part is a placeholder for how S3Adapter would get credentials.
        // We will need to adjust S3StorageAdapter to accept accessKeyId and secretAccessKey in its constructor options.
      });
      // TODO: Modify S3StorageAdapter to accept explicit credentials similar to R2StorageAdapter
      // For now, this test won't work correctly for S3 unless S3StorageAdapter is updated.
      // This highlights a needed refactor in S3StorageAdapter or a different validation strategy.

      // Let's construct S3 adapter with the right options, assuming it CAN take credentials
      // This implies S3AdapterOptions needs to be extended or it needs a way to pass credentials to S3Client
      const { S3Client } = await import('@aws-sdk/client-s3');
      const s3ClientForValidation = new S3Client({
        region: cfg.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        }
      });
      adapter = new S3StorageAdapter({bucket: cfg.bucket, region: cfg.region, client: s3ClientForValidation});

    } else if (cfg.type === 'r2') {
      adapter = new R2StorageAdapter({
        bucket: cfg.bucket,
        endpoint: cfg.endpoint!,
        accessKeyId,
        secretAccessKey,
        region: cfg.region || 'auto',
        forcePathStyle: cfg.forcePathStyle === undefined ? true : cfg.forcePathStyle,
      });
    } else {
      await cfgRef.update({
        validationStatus: 'error',
        validationError: `Unsupported provider type: ${cfg.type}`,
        lastValidatedAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse(`Unsupported provider type: ${cfg.type}`, { status: 400 });
    }

    const tmpKey = `validation/${providerConfigId}-${randomUUID()}.txt`;
    
    try {
      await adapter.write(tmpKey, 'PageLifeline validation ping');
      const content = await adapter.read(tmpKey);
      if (content.toString() !== 'PageLifeline validation ping') {
        throw new Error("Content mismatch during validation read.");
      }
      await adapter.delete(tmpKey);

      await cfgRef.update({
        validationStatus: 'success',
        validationError: FieldValue.delete(), // Clear error on success
        lastValidatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ status: 'success', message: 'Provider configuration validated successfully.' });
    } catch (validationError: any) {
      console.error(`Validation failed for ${providerConfigId}:`, validationError);
      await cfgRef.update({
        validationStatus: 'error',
        validationError: validationError.message || 'Unknown validation error',
        lastValidatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { status: 'error', message: 'Validation failed', details: validationError.message }, 
        { status: 400 } // Use 400 for client-side type error (bad creds), 500 for actual server issues
      );
    }
  } catch (error: any) {
    console.error(`Error processing validation for ${providerConfigId}:`, error);
    // Update Firestore with a generic error if we didn't reach specific validation failure handling
    // Check if cfgRef was successfully retrieved before trying to update
    try {
        const snap = await cfgRef.get();
        if (snap.exists) {
            await cfgRef.update({
                validationStatus: 'error',
                validationError: error.message || 'General error during validation process',
                lastValidatedAt: FieldValue.serverTimestamp(),
            });
        }
    } catch (dbError) {
        console.error(`Failed to update validation status after general error for ${providerConfigId}:`, dbError);
    }
    return new NextResponse('Internal Server Error during validation', { status: 500 });
  }
} 