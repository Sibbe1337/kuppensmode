"use client";

import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useUser } from '@clerk/nextjs'; // To check user state
import posthog from 'posthog-js'; // For tracking completion

// Example steps for the onboarding tour
const TOUR_STEPS: Step[] = [
  {
    target: ".create-snapshot-fab", // Target the FAB by class name
    content: "Welcome! Click here to create your first Notion snapshot backup.",
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: ".snapshots-table", // Target the table container/wrapper
    content: "Your created snapshots will appear here. You can see the date, size, and status.",
    placement: 'bottom',
  },
  {
    target: ".restore-button", // Target the first restore button (adjust selector if needed)
    content: "Use the 'Restore' button to roll back a page or database to a previous version.",
    placement: 'right',
  },
  {
    target: ".sidebar-settings-link", // Target the Settings link in the sidebar
    content: "Manage your Notion connection, API keys, and notification preferences in Settings.",
    placement: 'right',
  },
  {
    target: ".sidebar-quota-section", // Target the quota section in the sidebar
    content: "Keep an eye on your snapshot and storage usage here. You can upgrade your plan anytime.",
    placement: 'right',
  },
];

const OnboardingTour = () => {
  const { isLoaded, isSignedIn } = useUser();
  const [runTour, setRunTour] = useState(false);

  // TODO: Replace localStorage with user profile setting for persistence
  const TOUR_STORAGE_KEY = 'notionLifeline_onboardingComplete';

  useEffect(() => {
    // Start tour only if user is loaded, signed in, and hasn't completed it before
    if (isLoaded && isSignedIn) {
      const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!tourCompleted) {
        // Small delay to ensure target elements are rendered
        const timer = setTimeout(() => setRunTour(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoaded, isSignedIn]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // User finished or skipped the tour
      setRunTour(false);
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      posthog.capture('onboarding_completed', { action: action });
    }

    // You can track individual step completion here too if needed
    // if (type === 'step:after') {
    //   posthog.capture('onboarding_step_viewed', { step_index: data.index });
    // }

    console.log("Joyride callback:", data);
  };

  // Don't render anything if tour shouldn't run or user isn't loaded/signed in
  if (!runTour || !isLoaded || !isSignedIn) {
      return null;
  }

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={runTour}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 10000, // Ensure it's above other elements
          primaryColor: '#0078D4', // Example: Notion Blue
          arrowColor: '#fff',
          backgroundColor: '#fff',
          textColor: '#333',
        },
        tooltip: {
           borderRadius: '0.5rem',
        },
        buttonNext: {
          borderRadius: '0.375rem',
        },
         buttonBack: {
          borderRadius: '0.375rem',
        },
        buttonSkip: {
            color: '#555',
        }
      }}
    />
  );
};

export default OnboardingTour; 