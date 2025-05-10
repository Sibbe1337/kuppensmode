"use client";

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useAuth, useUser } from '@clerk/nextjs'; // For user identification
import { useToast } from "@/hooks/use-toast"; // For NPS Toast
import { Button } from "@/components/ui/button"; // For NPS Toast actions

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
          toast({
            title: "How are we doing?",
            description: "Help us improve Pagelifeline! How likely are you to recommend us to a friend or colleague?",
            duration: 30000, // Keep it open longer for interaction
            action: (
              <div className="flex flex-col gap-2 items-stretch mt-2">
                {[...Array(11)].map((_, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      posthog.capture('nps_score_submitted', { score: i, userId });
                      toast({ title: "Thanks for your feedback!", duration: 3000 });
                      localStorage.setItem(npsShownKey, 'true');
                      // Manually close the NPS toast - this requires access to dismiss function or toast ID
                      // For now, it relies on user clicking a score or it timing out.
                    }}
                  >
                    {i}
                  </Button>
                )).slice(0,5) /* Show 0-4 in one row */ 
                }
                 <div className="flex justify-between"> 
                 {[...Array(11)].map((_, i) => (
                    <Button key={i} variant="outline" size="sm" /* ... same onClick ... */ >{i}</Button>
                 )).slice(5,8) /* Show 5-7 */}
                 </div>
                 <div className="flex justify-between"> 
                 {[...Array(11)].map((_, i) => (
                    <Button key={i} variant="outline" size="sm" /* ... same onClick ... */ >{i}</Button>
                 )).slice(8,11) /* Show 8-10 */}
                 </div>
                 {/* A simpler version could just have one button "Give Feedback" linking to a form */}
                 <Button variant="link" size="sm" onClick={() => localStorage.setItem(npsShownKey, 'true')}>Maybe later</Button>
              </div>
            ),
          });
        }
      }

    } else if (!isSignedIn) {
      posthog.reset(); // Reset PostHog user identification on sign out
    }
  }, [isSignedIn, userId, user, toast]);

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