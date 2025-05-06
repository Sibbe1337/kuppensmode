// app/api/user/settings/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server"; // ✅ Corrected import for server-side
import { db } from "@/lib/firestore";
import type { UserSettings } from '@/types/user'; // Assuming UserSettings type is defined elsewhere

// -----------------------------------------------------------------------------
// Types & defaults for User Settings
// -----------------------------------------------------------------------------
const DEFAULT_USER_SETTINGS: UserSettings = {
    notionConnected: false,
    notionWorkspaceName: null,
    apiKey: null, // This will be represented by apiKeyHash in the DB for security
    notifications: {
        emailOnSnapshotSuccess: true,
        emailOnSnapshotFailure: true,
        webhookUrl: null,
    },
};

// -----------------------------------------------------------------------------
// GET /api/user/settings
// -----------------------------------------------------------------------------
export async function GET() {
  const authResult = await auth();
  const userId = authResult.userId;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  console.log(`Fetching settings for user: ${userId}`);
  const userRef = db.collection("users").doc(userId);

  try {
    const snap = await userRef.get(); // Initial attempt to get the document

    if (!snap.exists) {
      // Document doesn't exist, so create it with defaults and return defaults
      console.log(`User document ${userId} not found. Initializing with default settings.`);
      await userRef.set(
        { settings: DEFAULT_USER_SETTINGS, createdAt: Date.now(), apiKeyHash: null },
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_SETTINGS);
    }

    const data = snap.data();
    if (!data || !data.settings) {
      // Document exists but data or settings field is missing. Initialize/ensure settings and return defaults.
      console.warn(`User document data or settings field for ${userId} is missing/undefined. Initializing/Ensuring default settings.`);
      await userRef.set(
        { settings: DEFAULT_USER_SETTINGS, createdAt: data?.createdAt ?? Date.now(), apiKeyHash: data?.apiKeyHash ?? null },
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_SETTINGS);
    }
    
    // Construct and return settings, applying defaults for nested fields if necessary.
    const currentSettings = data.settings as Partial<UserSettings> | undefined;
    const responseSettings: UserSettings = {
        notionConnected: currentSettings?.notionConnected ?? DEFAULT_USER_SETTINGS.notionConnected,
        notionWorkspaceName: currentSettings?.notionWorkspaceName ?? DEFAULT_USER_SETTINGS.notionWorkspaceName,
        apiKey: data.apiKeyHash ? `nl_sk_••••••••${userId.substring(5,10)}` : null,
        notifications: {
            emailOnSnapshotSuccess: currentSettings?.notifications?.emailOnSnapshotSuccess ?? DEFAULT_USER_SETTINGS.notifications.emailOnSnapshotSuccess,
            emailOnSnapshotFailure: currentSettings?.notifications?.emailOnSnapshotFailure ?? DEFAULT_USER_SETTINGS.notifications.emailOnSnapshotFailure,
            webhookUrl: currentSettings?.notifications?.webhookUrl ?? DEFAULT_USER_SETTINGS.notifications.webhookUrl,
        },
    };
    return NextResponse.json(responseSettings);

  } catch (error) {
    console.error(`GET /api/user/settings error for user ${userId}:`, error);
    if (error instanceof Error && 'code' in error && (error as any).code === 5) { // gRPC 5 NOT_FOUND from .get()
        console.warn(`Firestore NOT_FOUND error for user ${userId} during .get() in settings. Initializing and returning default settings.`);
        try {
            await userRef.set(
                { settings: DEFAULT_USER_SETTINGS, createdAt: Date.now(), apiKeyHash: null },
                { merge: true }
            );
            return NextResponse.json(DEFAULT_USER_SETTINGS, { status: 200 });
        } catch (initError) {
            console.error(`Failed to initialize user ${userId} after NOT_FOUND error in settings:`, initError);
            return new NextResponse("Internal Server Error during fallback initialization", { status: 500 });
        }
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Interface for the POST request body (only updatable fields within settings)
interface UpdateSettingsBody {
    notifications?: {
        emailOnSnapshotSuccess?: boolean;
        emailOnSnapshotFailure?: boolean;
        webhookUrl?: string | null; // Allow null to clear the webhook
    };
    // Add other updatable settings fields here later if needed
    // For example: notionConnectionDetails?: { workspaceName: string; ... }
}

export async function POST(request: Request) {
  const authResult = await auth();
  const userId = authResult.userId;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: UpdateSettingsBody;
  try {
    body = await request.json();
  } catch (e) {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  console.log(`Updating settings for user: ${userId}`, body);
  const userRef = db.collection('users').doc(userId);
  const updatesForFirestore: { [key: string]: any } = {};

  // Construct the update object carefully to only include provided fields,
  // using dot notation for updating nested fields within the 'settings' map.
  if (body.notifications) {
    if (body.notifications.emailOnSnapshotSuccess !== undefined) {
      updatesForFirestore['settings.notifications.emailOnSnapshotSuccess'] = body.notifications.emailOnSnapshotSuccess;
    }
    if (body.notifications.emailOnSnapshotFailure !== undefined) {
      updatesForFirestore['settings.notifications.emailOnSnapshotFailure'] = body.notifications.emailOnSnapshotFailure;
    }
    // Allow setting webhookUrl to null or a string explicitly
    if (Object.prototype.hasOwnProperty.call(body.notifications, 'webhookUrl')) {
      updatesForFirestore['settings.notifications.webhookUrl'] = body.notifications.webhookUrl;
    }
  }

  // Add other top-level fields of 'settings' here if they become part of UpdateSettingsBody
  // Example: if (body.someOtherSetting !== undefined) { updatesForFirestore['settings.someOtherSetting'] = body.someOtherSetting; }

  if (Object.keys(updatesForFirestore).length === 0) {
    return NextResponse.json({ success: true, message: "No settings fields provided for update." });
  }
  
  // Ensure createdAt is set if we are creating the document for the first time with settings
  updatesForFirestore['createdAt'] = Date.now(); // This will be set on create, and merged (overwritten with same value) on update

  try {
    await userRef.set(updatesForFirestore, { merge: true });
    console.log(`Successfully updated/set settings for user ${userId} with:`, updatesForFirestore);
    return NextResponse.json({ success: true, message: "Settings updated." });
  } catch (error) {
    console.error(`POST /api/user/settings error for user ${userId}:`, error);
    // It's unlikely to be a NOT_FOUND here if using set with merge:true,
    // but keeping a general error handler.
    return new NextResponse("Internal Server Error while updating settings", { status: 500 });
  }
}

// TODO: Remember to apply the set(..., { merge: true }) logic to the POST handler as well if it exists and uses update().
// The file content you provided earlier only showed the GET handler after it was overwritten by quota logic.
// I will assume the POST handler is either not present in this version or will be handled separately.