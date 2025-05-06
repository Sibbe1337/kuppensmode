"use client";

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useAuth, useUser } from '@clerk/nextjs'; // For user identification

// Check if PostHog is client-side enabled
if (typeof window !== 'undefined') {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Enable debug mode in development
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug();
      },
      // Autocapture is generally recommended for web apps
      autocapture: true, 
      // Disable session recording by default - enable if needed and compliant
      disable_session_recording: true,
      // Capture pageviews manually using App Router navigation events if needed
      capture_pageview: false, 
    });
  } else {
    console.warn("PostHog key not found. Analytics disabled.");
  }
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

// Component to handle user identification
function PostHogAuthWrapper({ children }: PostHogProviderProps) {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn && userId && user) {
      posthog.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        // Add any other user properties you want to track
      });
    } else if (!isSignedIn) {
      posthog.reset(); // Reset PostHog user identification on sign out
    }
  }, [isSignedIn, userId, user]);

  return <>{children}</>;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  // Ensure PostHog is initialized before rendering the provider
  // Checking posthogKey again ensures provider doesn't run if init failed
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      return <>{children}</>; // Render children without provider if PostHog is disabled
  }

  return (
    <PHProvider client={posthog}>
        <PostHogAuthWrapper>{children}</PostHogAuthWrapper>
    </PHProvider>
  );
} 