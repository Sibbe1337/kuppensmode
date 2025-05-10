"use client";

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useAuth, useUser } from '@clerk/nextjs'; // For user identification
import { useToast } from "@/hooks/use-toast"; // For NPS Toast
import { Button } from "@/components/ui/button"; // For NPS Toast actions
import NPSModal from "@/components/modals/NPSModal"; // Import NPSModal

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
  const { toast } = useToast();
  const [isNPSModalOpen, setIsNPSModalOpen] = useState(false); // State for NPS modal

  useEffect(() => {
    if (isSignedIn && userId && user) {
      posthog.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        // Add any other user properties you want to track
      });

      // B.4: NPS Logic - Track logins and show NPS toast
      const npsShownKey = `npsShown_${userId}`;
      const loginCountKey = `loginCount_${userId}`;

      if (localStorage.getItem(npsShownKey) !== 'true') {
        let currentLoginCount = parseInt(localStorage.getItem(loginCountKey) || '0', 10);
        
        // Check if this is a new login session to increment count
        // This simple check increments every time this effect runs while signed in.
        // A more robust way might involve checking a session flag or timestamp.
        // For simplicity, we assume this effect runs once per "effective" new login/app load while signed in.
        currentLoginCount++;
        localStorage.setItem(loginCountKey, currentLoginCount.toString());

        if (currentLoginCount === 3) {
          // Open the modal instead of complex toast
          // setIsNPSModalOpen(true); 
          // Decided to keep the toast as a less intrusive prompt, then modal opens from toast action
          toast({
            title: "How are we doing?",
            description: "Help us improve Pagelifeline! Would you take a moment to share your feedback?",
            duration: 30000, 
            action: (
              <div className="flex flex-col gap-2 items-stretch mt-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => {
                    posthog.capture('nps_feedback_prompt_clicked', { userId });
                    setIsNPSModalOpen(true); // Open modal from toast action
                    // Toast will be dismissed by user or timeout, or NPSModal will mark npsShown
                  }}
                >
                  Rate Us
                </Button>
                <Button variant="link" size="sm" onClick={() => {
                    localStorage.setItem(npsShownKey, 'true'); // Mark as shown if user clicks maybe later
                    // Manually close toast if toast component provides a way (e.g. by id)
                }} className="text-xs">
                    Maybe later
                </Button>
              </div>
            ),
          });
        }
      }

    } else if (!isSignedIn) {
      posthog.reset(); // Reset PostHog user identification on sign out
    }
  }, [isSignedIn, userId, user, toast]);

  return (
    <>
      {children}
      <NPSModal isOpen={isNPSModalOpen} onOpenChange={setIsNPSModalOpen} />
    </>
  );
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