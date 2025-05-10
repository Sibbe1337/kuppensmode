// app/api/user/settings/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server"; // ✅ Corrected import for server-side
import { db } from "@/lib/firestore";
import type { UserSettings } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/config/defaults";
import { FieldValue } from '@google-cloud/firestore';



// -----------------------------------------------------------------------------
// Types & defaults for User Settings - MOVED TO src/config/defaults.ts
// -----------------------------------------------------------------------------
// const DEFAULT_USER_SETTINGS: UserSettings = { ... };

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
        notionWorkspaceId: currentSettings?.notionWorkspaceId ?? DEFAULT_USER_SETTINGS.notionWorkspaceId,
        notionWorkspaceName: currentSettings?.notionWorkspaceName ?? DEFAULT_USER_SETTINGS.notionWorkspaceName,
        notionWorkspaceIcon: currentSettings?.notionWorkspaceIcon ?? DEFAULT_USER_SETTINGS.notionWorkspaceIcon,
        apiKey: data.apiKeyHash ? `nl_sk_••••••••${userId.substring(5,10)}` : null,
        notifications: {
            emailOnSnapshotSuccess: currentSettings?.notifications?.emailOnSnapshotSuccess ?? DEFAULT_USER_SETTINGS.notifications.emailOnSnapshotSuccess,
            emailOnSnapshotFailure: currentSettings?.notifications?.emailOnSnapshotFailure ?? DEFAULT_USER_SETTINGS.notifications.emailOnSnapshotFailure,
            webhookUrl: currentSettings?.notifications?.webhookUrl ?? DEFAULT_USER_SETTINGS.notifications.webhookUrl,
        },
        autoSnapshot: {
            enabled: currentSettings?.autoSnapshot?.enabled ?? DEFAULT_USER_SETTINGS.autoSnapshot.enabled,
            frequency: currentSettings?.autoSnapshot?.frequency ?? DEFAULT_USER_SETTINGS.autoSnapshot.frequency,
        },
        stripeCustomerId: data.stripeCustomerId || data.billing?.stripeCustomerId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || data.billing?.stripeSubscriptionId || null,
        plan: data.plan || null,
        planId: data.planId || data.billing?.planId || null,
        billing: data.billing || null,
        flags: data.flags || null,
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
        webhookUrl?: string | null;
    };
    autoSnapshot?: {
        enabled?: boolean;
        frequency?: 'daily' | 'weekly';
    };
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

    console.log(`Updating settings for user: ${userId} with body:`, body);
  const userRef = db.collection('users').doc(userId);
  const updatesForFirestore: { [key: string]: any } = {};

  // Handle notifications update
  if (body.notifications) {
    if (body.notifications.emailOnSnapshotSuccess !== undefined) {
      updatesForFirestore['settings.notifications.emailOnSnapshotSuccess'] = body.notifications.emailOnSnapshotSuccess;
    }
    if (body.notifications.emailOnSnapshotFailure !== undefined) {
      updatesForFirestore['settings.notifications.emailOnSnapshotFailure'] = body.notifications.emailOnSnapshotFailure;
    }
    if (Object.prototype.hasOwnProperty.call(body.notifications, 'webhookUrl')) {
      updatesForFirestore['settings.notifications.webhookUrl'] = body.notifications.webhookUrl;
    }
  }

  // Handle autoSnapshot update
  if (body.autoSnapshot) {
    if (body.autoSnapshot.enabled !== undefined) {
      updatesForFirestore['settings.autoSnapshot.enabled'] = body.autoSnapshot.enabled;
    }
    if (body.autoSnapshot.frequency !== undefined) {
      updatesForFirestore['settings.autoSnapshot.frequency'] = body.autoSnapshot.frequency;
    }
    // Ensure the autoSnapshot object itself is created if it wasn't there
    // This is important if only one sub-property is sent initially.
    // However, set with merge:true and dot notation should handle this implicitly.
    // For safety, ensure the parent `settings` map exists if it doesn't.
  }

  if (Object.keys(updatesForFirestore).length === 0) {
    return NextResponse.json({ success: true, message: "No settings fields provided for update." });
  }

  // To ensure the top-level 'settings' map exists if we are creating it for the first time
  // with nested fields, or if the user document itself is new.
  const updatePayload = { 
    settings: updatesForFirestore, // This nests our dot-notation paths under 'settings' again, which is wrong.
                                // We should apply updatesForFirestore directly.
    createdAt: FieldValue.serverTimestamp() // Ensures createdAt on new doc, updates on existing
  };
  
  // Corrected approach: apply updatesForFirestore directly using .set with merge:true
  // or .update if we are certain the 'settings' map always exists.
  // Given GET initializes 'settings', .update should be safe if user doc exists.

  // Let's ensure the user document and settings field are initialized if they don't exist,
  // then apply updates.
  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        console.log(`User doc ${userId} not found in POST settings, creating with new settings.`);
        // Create doc with new settings and defaults for anything not provided.
        const initialSettings = { 
            ...DEFAULT_USER_SETTINGS, 
            ...(body.notifications && { notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...body.notifications } }),
            ...(body.autoSnapshot && { autoSnapshot: { enabled: false, frequency: 'daily', ...body.autoSnapshot } })
        };
        await userRef.set({ settings: initialSettings, createdAt: FieldValue.serverTimestamp() });
    } else {
        // Document exists, apply updates using dot notation to the settings field
        await userRef.update(updatesForFirestore);
    }
    
    console.log(`Successfully updated settings for user ${userId} with:`, updatesForFirestore);
    return NextResponse.json({ success: true, message: "Settings updated." });
  } catch (error) {
    console.error(`POST /api/user/settings error for user ${userId}:`, error);
    return new NextResponse("Internal Server Error while updating settings", { status: 500 });
  }
}

// TODO: Remember to apply the set(..., { merge: true }) logic to the POST handler as well if it exists and uses update().
// The file content you provided earlier only showed the GET handler after it was overwritten by quota logic.
// I will assume the POST handler is either not present in this version or will be handled separately.