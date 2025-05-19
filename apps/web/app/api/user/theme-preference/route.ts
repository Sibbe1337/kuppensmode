import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

interface ThemePreferenceRequestBody {
  theme: 'light' | 'dark' | 'system';
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ThemePreferenceRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { theme } = body;
  if (!['light', 'dark', 'system'].includes(theme)) {
    return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        theme_preference: theme,
      },
    });
    console.log(`[API ThemePref] User ${userId} theme preference updated to: ${theme}`);
    return NextResponse.json({ success: true, theme });
  } catch (error) {
    console.error(`[API ThemePref] Error updating Clerk user metadata for ${userId}:`, error);
    return NextResponse.json({ error: 'Failed to save theme preference' }, { status: 500 });
  }
} 