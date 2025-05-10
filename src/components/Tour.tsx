"use client";

import React, { useEffect, useState } from 'react';
import Joyride, { Step, CallBackProps, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTheme } from 'next-themes';

// Define the steps for the tour
const tourSteps: Step[] = [
  {
    target: '.tour-step-connect', // Placeholder: Element for connecting to Notion (e.g., in settings or an initial CTA)
    content: 'First, connect your Notion workspace to allow us to create backups.',
    placement: 'bottom',
    title: 'Connect to Notion',
  },
  {
    target: '.tour-step-snapshot', // Placeholder: The "New Snapshot" button on the dashboard
    content: 'Great! Now, let\'s create your first snapshot. This will back up your Notion data.',
    placement: 'bottom',
    title: 'Create a Snapshot',
  },
  {
    target: '.tour-step-restore', // Placeholder: A "Restore" button on a snapshot card in SnapshotsTable
    content: 'Once a snapshot is created, you can easily restore your data from here.',
    placement: 'left',
    title: 'Restore a Snapshot',
  },
  {
    target: '.tour-step-upgrade', // Placeholder: The QuotaProgressButton or an upgrade callout
    content: 'Keep an eye on your usage. You can upgrade your plan anytime for more snapshots and features!',
    placement: 'bottom',
    title: 'Manage Your Plan',
  },
];

interface Props {
  runTour?: boolean; // Prop to manually trigger from parent if needed, besides auto-launch
}

const Tour: React.FC<Props> = ({ runTour: manualRun }) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    const tourDone = localStorage.getItem('tourDone');
    if (tourDone !== '1') {
      setRun(true);
    }
  }, []);

  useEffect(() => {
    if (manualRun) {
        setRun(true);
        setStepIndex(0); // Reset to start if manually triggered
    }
  }, [manualRun]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Update step index
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Tour finished or skipped
      setRun(false);
      localStorage.setItem('tourDone', '1');
    } else if (type === EVENTS.TOUR_END && action === ACTIONS.CLOSE) {
      // This handles closing the tour via the 'x' button on the tooltip or ESC
      setRun(false);
      localStorage.setItem('tourDone', '1');
    } else if (type === EVENTS.ERROR) {
        // If it's an error, like target not found, but not specifically TARGET_NOT_FOUND handled above
        // often better to stop the tour to prevent user frustration.
        console.error("Joyride error:", data);
        setRun(false);
        localStorage.setItem('tourDone', '1'); // Mark as done to prevent re-triggering on error loop
    }

    console.log('Joyride callback:', data);
  };

  // Styles for react-joyride to match Tailwind/shadcn theme
  // These are basic, can be expanded significantly
  const joyrideStyles = {
    options: {
      arrowColor: theme === 'dark' ? '#27272a' : '#ffffff', // zinc-800 or white
      backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff',
      primaryColor: '#10b981', // emerald-500 (accent color from plan)
      textColor: theme === 'dark' ? '#fafafa' : '#09090b', // zinc-50 or zinc-950
      zIndex: 1000,
    },
    tooltip: {
        fontSize: 15,
        borderRadius: '0.5rem', // Corresponds to rounded-lg
    },
    buttonNext: {
        borderRadius: '0.375rem', // Corresponds to rounded-md
    },
    buttonBack: {
        borderRadius: '0.375rem',
        marginRight: 10,
    },
    buttonSkip: {
        borderRadius: '0.375rem',
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={joyrideStyles}
      // debug
    />
  );
};

export default Tour; 