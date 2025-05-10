"use client";

import React, { useEffect, useState } from 'react';
import Joyride, { Step, CallBackProps, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTheme } from 'next-themes';
import posthog from 'posthog-js';
import { useSandbox, setSandboxMode } from '@/hooks/useSandbox';
import { useRouter } from 'next/navigation';

const commonSteps: Omit<Step, 'target'>[] = [
  {
    content: 'Great! Now, let\'s create your first snapshot. This will back up your Notion data.',
    placement: 'bottom',
    title: 'Create a Snapshot',
  },
  {
    content: 'Once a snapshot is created, you can easily restore your data from here.',
    placement: 'left',
    title: 'Restore a Snapshot',
  },
  {
    content: 'Keep an eye on your usage. You can upgrade your plan anytime for more snapshots and features!',
    placement: 'bottom',
    title: 'Manage Your Plan',
  },
];

const getTourSteps = (isSandbox: boolean): Step[] => {
  if (isSandbox) {
    return [
      {
        target: '.tour-step-snapshot',
        content: 'Welcome to the Demo! Try creating a (simulated) snapshot of this demo workspace.',
        placement: 'bottom',
        title: 'Demo: Create Snapshot',
      },
      {
        target: '.tour-step-restore',
        content: 'You can also restore snapshots. In demo mode, this is simulated.',
        placement: 'left',
        title: 'Demo: Restore Snapshot',
      },
      {
        target: 'body',
        content: 'Enjoyed the demo? Connect your real Notion workspace to get started for real!',
        placement: 'center',
        title: 'Connect Your Notion',
      },
    ];
  } else {
    return [
      {
        target: '.tour-step-connect',
        content: 'First, connect your Notion workspace to allow us to create backups.',
        placement: 'bottom',
        title: 'Connect to Notion',
      },
      { target: '.tour-step-snapshot', ...commonSteps[0] },
      { target: '.tour-step-restore', ...commonSteps[1] },
      { target: '.tour-step-upgrade', ...commonSteps[2] },
    ];
  }
};

interface Props {
  runTour?: boolean;
}

const Tour: React.FC<Props> = ({ runTour: manualRun }) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { theme } = useTheme();
  const isSandbox = useSandbox();
  const router = useRouter();
  const tourSteps = getTourSteps(isSandbox);

  useEffect(() => {
    const tourDoneKey = isSandbox ? 'sandboxTourDone' : 'tourDone';
    const tourHasBeenDone = localStorage.getItem(tourDoneKey);
    if (tourHasBeenDone !== '1') {
      setRun(true);
      setStepIndex(0);
    }
  }, [isSandbox]);

  useEffect(() => {
    if (manualRun) {
        setRun(true);
        setStepIndex(0);
    }
  }, [manualRun]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type, step } = data;
    const tourDoneKey = isSandbox ? 'sandboxTourDone' : 'tourDone';

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    } else if (status === STATUS.FINISHED) {
      setRun(false);
      localStorage.setItem(tourDoneKey, '1');
      if (isSandbox && step.title === 'Connect Your Notion') {
        posthog.capture('sandbox_tour_completed_cta_clicked');
        setSandboxMode(false);
        router.push('/dashboard/settings');
      } else if (!isSandbox) {
        posthog.capture('main_tour_completed');
      }
    } else if (status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(tourDoneKey, '1');
      posthog.capture(isSandbox ? 'sandbox_tour_skipped' : 'main_tour_skipped', { at_step: index });
    } else if (type === EVENTS.TOUR_END && action === ACTIONS.CLOSE) {
      setRun(false);
      localStorage.setItem(tourDoneKey, '1');
      posthog.capture(isSandbox ? 'sandbox_tour_closed' : 'main_tour_closed', { at_step: index });
    } else if (type === EVENTS.ERROR) {
        console.error("Joyride error:", data);
        setRun(false);
        localStorage.setItem(tourDoneKey, '1');
    }
  };

  const joyrideStyles = {
    options: {
      arrowColor: theme === 'dark' ? '#27272a' : '#ffffff',
      backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff',
      primaryColor: '#10b981',
      textColor: theme === 'dark' ? '#fafafa' : '#09090b',
      zIndex: 1000,
    },
    tooltip: { fontSize: 15, borderRadius: '0.5rem' },
    buttonNext: { borderRadius: '0.375rem' },
    buttonBack: { borderRadius: '0.375rem', marginRight: 10 },
    buttonSkip: { borderRadius: '0.375rem' }
  };

  if (!run || tourSteps.length === 0) return null;

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
    />
  );
};

export default Tour; 