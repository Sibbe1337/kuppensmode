"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

export function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only capture pageviews if PostHog is initialized (key is present)
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY && pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + '#' + searchParams.toString(); // Standard for PostHog is to use # for SPA URLs if not setting $current_url fully
        // Alternatively, and often better for Next.js App Router:
        // url = window.origin + pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      }
      
      // Using posthog.capture('$pageview', { $current_url: url }) is more explicit for SPAs
      // if capture_pageview is false during init.
      posthog.capture('$pageview', {
        // PostHog specific properties. Refer to their docs for best practices.
        '$current_url': window.location.href, // Use full href captured by browser
        '$pathname': pathname,
        // You can add more properties if needed, e.g. from searchParams
      });
    }
  }, [pathname, searchParams]);

  return null;
} 