"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // For API key input
import { Label } from "@/components/ui/label";   // For form labels
import { Switch } from "@/components/ui/switch"; // For toggles
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // For organizing sections
import { ExternalLink, KeyRound, Bell, LogOut, HelpCircle, ShieldCheck, Loader2, AlertTriangle, Info, Zap, CreditCard, Gift, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { useUserSettings } from '@/hooks/useUserSettings'; // Corrected hook import
import type { UserSettings as CommonUserSettings } from '@notion-lifeline/common-types';
import type { UserSettings as AppUserSettings } from '@/types/user'; // Local type for component state if different
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // For frequency selection
import LoadingFallback from '@/components/ui/LoadingFallback'; // Import LoadingFallback
import Link from 'next/link'; // Correct: Import Link from next/link

const SettingsPageContent = () => {
  const { settings, isLoading, isError, mutateSettings } = useUserSettings();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [isNotionCurrentlyConnected, setIsNotionCurrentlyConnected] = useState(settings?.notionConnected ?? false);

  console.log("SettingsPage: Top level render. Initial settings?.notionConnected:", settings?.notionConnected, "isNotionCurrentlyConnected:", isNotionCurrentlyConnected);

  const [isDisconnectingNotion, setIsDisconnectingNotion] = React.useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = React.useState(false);
  
  const [editedNotifications, setEditedNotifications] = React.useState<AppUserSettings['notifications']>(() => {
    const commonNotifications = settings?.notifications;
    return {
      emailOnSnapshotSuccess: commonNotifications?.emailOnSnapshotSuccess ?? true,
      emailOnSnapshotFailure: commonNotifications?.emailOnSnapshotFailure ?? true,
      webhookUrl: commonNotifications?.webhookUrl ?? "",
    };
  });

  const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);

  const [editedAutoSnapshot, setEditedAutoSnapshot] = React.useState<AppUserSettings['autoSnapshot']>(() => {
    const commonAutoSnapshot = settings?.autoSnapshot;
    let initialFrequency: AppUserSettings['autoSnapshot']['frequency'] = 'daily';

    if (commonAutoSnapshot?.frequency) {
      if (commonAutoSnapshot.frequency === 'daily') {
        initialFrequency = 'daily';
      } else if (commonAutoSnapshot.frequency === 'hourly') {
        initialFrequency = 'daily';
        console.warn("Auto-snapshot frequency 'hourly' from backend is not supported by UI, defaulting to 'daily'.");
      }
    }

    return {
      enabled: commonAutoSnapshot?.enabled ?? false,
      frequency: initialFrequency,
    };
  });

  const [isSavingAutoSnapshot, setIsSavingAutoSnapshot] = React.useState(false);

  useEffect(() => {
    console.log("SettingsPage: useEffect for settings update. New settings?.notionConnected:", settings?.notionConnected);
    if (settings) {
      setIsNotionCurrentlyConnected(settings.notionConnected);
      setEditedNotifications({
        emailOnSnapshotSuccess: settings.notifications?.emailOnSnapshotSuccess ?? true,
        emailOnSnapshotFailure: settings.notifications?.emailOnSnapshotFailure ?? true,
        webhookUrl: settings.notifications?.webhookUrl ?? "",
      });

      let updatedFrequency: AppUserSettings['autoSnapshot']['frequency'] = 'daily';
      if (settings.autoSnapshot?.frequency) {
        if (settings.autoSnapshot.frequency === 'daily') {
          updatedFrequency = 'daily';
        } else if (settings.autoSnapshot.frequency === 'hourly') {
          updatedFrequency = 'daily';
        }
      }
      setEditedAutoSnapshot({
        enabled: settings.autoSnapshot?.enabled ?? false,
        frequency: updatedFrequency,
      });
      if (settings.apiKey) {
        setApiKey(settings.apiKey ?? "");
      }
    }
  }, [settings]);

  React.useEffect(() => {
    const notionQueryParam = searchParams.get('notion');
    const errorQueryParam = searchParams.get('error');

    console.log("SettingsPage: useEffect for query params fired. notionQueryParam:", notionQueryParam, "errorQueryParam:", errorQueryParam);

    if (notionQueryParam === 'connected') {
      console.log("SettingsPage: Detected notion=connected. Will call mutateSettings() after short delay.");
      toast({ title: "Success", description: "Notion workspace connected successfully!" });
      
      const timer = setTimeout(() => {
        console.log("SettingsPage: Calling mutateSettings() after delay.");
        mutateSettings(); 
      }, 250);

      window.history.replaceState(null, '', '/dashboard/settings');
      return () => clearTimeout(timer);

    } else if (errorQueryParam) {
      console.log("SettingsPage: Detected error query param:", errorQueryParam);
      toast({ title: "Error connecting Notion", description: decodeURIComponent(errorQueryParam), variant: "destructive" });
      window.history.replaceState(null, '', '/dashboard/settings');
    }
  }, [searchParams, mutateSettings, toast]);

  const handleNotionConnect = () => {
    console.log("Redirecting to Notion OAuth initiation endpoint...");
    window.location.href = '/api/auth/notion/start';
  };

  const handleNotionDisconnect = async () => {
    setIsDisconnectingNotion(true);
    try {
      const response = await fetch('/api/auth/notion', { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to disconnect Notion. Please try again.' }));
        throw new Error(errorData.message || 'Failed to disconnect Notion.');
      }
      toast({ title: "Success", description: "Notion workspace disconnected." });
      await mutateSettings(); 
      console.log("SettingsPage: mutateSettings called after disconnect.");
    } catch (error: any) {
      console.error("Error disconnecting Notion:", error);
      toast({ title: "Error", description: error.message || "Could not disconnect Notion.", variant: "destructive" });
    } finally {
      setIsDisconnectingNotion(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setIsRegeneratingKey(true);
    try {
      const response = await fetch('/api/user/api-key/regenerate', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to regenerate API key.'}));
        throw new Error(errorData.message || 'Failed to regenerate API key.');
      }
      toast({ title: "Success", description: "API Key regenerated successfully." });
      mutateSettings();
    } catch (error: any) {
      console.error("Error regenerating API key:", error);
      toast({ title: "Error", description: error.message || "Could not regenerate API key.", variant: "destructive" });
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleNotificationChange = (
    key: keyof AppUserSettings['notifications'],
    value: boolean | string | null
  ) => {
    setEditedNotifications((prev: AppUserSettings['notifications']) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: editedNotifications })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save notification settings.'}));
        throw new Error(errorData.message || 'Failed to save notification settings.');
      }
      toast({ title: "Success", description: "Notification preferences saved." });
      mutateSettings();
    } catch (error: any) {
      console.error("Error saving notifications:", error);
      toast({ title: "Error", description: error.message || "Failed to save preferences.", variant: "destructive" });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const hasNotificationChanges = React.useMemo(() => {
    if (!settings?.notifications) return false;
    return JSON.stringify(settings.notifications) !== JSON.stringify(editedNotifications);
  }, [settings?.notifications, editedNotifications]);

  const handleAutoSnapshotSettingChange = (
    key: keyof AppUserSettings['autoSnapshot'],
    value: boolean | AppUserSettings['autoSnapshot']['frequency']
  ) => {
    setEditedAutoSnapshot((prev: AppUserSettings['autoSnapshot']) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveAutoSnapshots = async () => {
    setIsSavingAutoSnapshot(true);
    let settingsSaved = false;
    try {
      const response = await fetch('/api/user/settings', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSnapshot: editedAutoSnapshot })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save auto-snapshot settings.'}));
        throw new Error(errorData.message || 'Failed to save auto-snapshot settings.');
      }
      settingsSaved = true;
      mutateSettings(); 

      const schedulerResponse = await fetch('/api/scheduler/auto-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedAutoSnapshot)
      });

      const schedulerData = await schedulerResponse.json();
      if (!schedulerResponse.ok) {
        throw new Error(schedulerData.error || 'Failed to update scheduler job.');
      }

      toast({ title: "Success", description: `Automated snapshot preferences saved. ${schedulerData.message}` });

    } catch (error: any) {
      console.error("Error in handleSaveAutoSnapshots:", error);
      let toastMessage = error.message || "Failed to save preferences.";
      if (settingsSaved && error.message.includes('scheduler')) {
        toastMessage = "Settings saved to database, but failed to update the schedule. Please try saving again or contact support.";
      }
      toast({ title: "Error", description: toastMessage, variant: "destructive" });
    } finally {
      setIsSavingAutoSnapshot(false);
    }
  };

  const hasAutoSnapshotChanges = React.useMemo(() => {
    if (!settings) return false; 
    const currentAutoSnapshot = settings.autoSnapshot || { enabled: false, frequency: 'daily' };
    return JSON.stringify(currentAutoSnapshot) !== JSON.stringify(editedAutoSnapshot);
  }, [settings, editedAutoSnapshot]);
  
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? "");

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/billing/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Could not redirect to billing portal.'}));
        throw new Error(errorData.message || 'Could not redirect to billing portal.');
      }
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("Billing portal URL not found.");
      }
    } catch (error: any) {
      console.error("Error managing subscription:", error);
      toast({ title: "Error", description: error.message || "Could not open billing portal.", variant: "destructive" });
    }
  };

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [isReferralLoading, setIsReferralLoading] = useState(true);

  useEffect(() => {
    const fetchReferralCode = async () => {
      setIsReferralLoading(true);
      try {
        const response = await fetch('/api/user/referral-code');
        if (!response.ok) throw new Error("Failed to fetch referral code");
        const data = await response.json();
        setReferralCode(data.referralCode);
        setReferralLink(`${window.location.origin}/?ref=${data.referralCode}`);
      } catch (error) {
        console.error("Error fetching referral code:", error);
        // Set to null or some error indicator if needed
      } finally {
        setIsReferralLoading(false);
      }
    };
    fetchReferralCode();
  }, []);

  const handleCopyReferralCode = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
        .then(() => toast({ title: "Copied!", description: "Referral link copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy link.", variant: "destructive" }));
    }
  };

  // Actual JSX for the page
  if (isLoading) return <div className="container mx-auto p-4"><LoadingFallback message="Loading your settings..." /></div>;
  if (isError || !settings) return <div className="container mx-auto p-4 text-red-500">Error loading settings. Please try again.</div>;

  // The entire return(...) JSX of the original SettingsPage goes here
  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Notion Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <img src="/images/notion-logo.png" alt="Notion" className="h-6 w-6 mr-2" />
            Notion Workspace
          </CardTitle>
          <CardDescription>
            {isNotionCurrentlyConnected 
              ? `Connected to: ${settings.notionWorkspaceName || 'Your Workspace'}` 
              : "Connect your Notion workspace to enable backups."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isNotionCurrentlyConnected ? (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center">
              <ShieldCheck className="h-4 w-4 mr-1" /> Connected. Snapshots are active based on your plan.
            </p>
          ) : (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" /> Not connected. Your workspace is not being backed up.
            </p>
          )}
        </CardContent>
        <CardFooter>
          {isNotionCurrentlyConnected ? (
            <Button variant="destructive" onClick={handleNotionDisconnect} disabled={isDisconnectingNotion}>
              {isDisconnectingNotion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect Notion
            </Button>
          ) : (
            <Button onClick={handleNotionConnect}>
              Connect to Notion
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <KeyRound className="h-5 w-5 mr-2" /> API Access
          </CardTitle>
          <CardDescription>Manage your API key for programmatic access (e.g., for CLI usage).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="apiKey">Your API Key</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input id="apiKey" type="password" value={apiKey || "Generate a key to see it here"} readOnly className="font-mono"/>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(apiKey); toast({title: "Copied!", description: "API Key copied to clipboard."})}} disabled={!apiKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {settings.apiKeyLastUsed && (
                <p className="text-xs text-muted-foreground mt-1">
                    Last used: {new Date(settings.apiKeyLastUsed).toLocaleDateString()} {new Date(settings.apiKeyLastUsed).toLocaleTimeString()}
                </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" onClick={handleGenerateApiKey} disabled={isRegeneratingKey}>
            {isRegeneratingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {settings.apiKey ? 'Regenerate Key' : 'Generate Key'}
          </Button>
        </CardFooter>
      </Card>

      {/* Auto Snapshot Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" /> Automated Snapshots
          </CardTitle>
          <CardDescription>Configure how often automated snapshots are taken. Requires an active subscription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="autoSnapshotEnabled" className="flex flex-col space-y-1">
              <span>Enable Automated Snapshots</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Automatically create snapshots of your workspace.
              </span>
            </Label>
            <Switch 
              id="autoSnapshotEnabled" 
              checked={editedAutoSnapshot.enabled} 
              onCheckedChange={(value: boolean) => handleAutoSnapshotSettingChange('enabled', value)} 
            />
          </div>
          {editedAutoSnapshot.enabled && (
            <div className="space-y-2">
              <Label htmlFor="snapshotFrequency">Snapshot Frequency</Label>
              <RadioGroup 
                id="snapshotFrequency"
                defaultValue={editedAutoSnapshot.frequency}
                onValueChange={(value: AppUserSettings['autoSnapshot']['frequency']) => handleAutoSnapshotSettingChange('frequency', value)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <Label htmlFor="hourly">Hourly (Recommended for active workspaces)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily">Daily (Usually around midnight in your timezone)</Label>
                </div>
                {/* Add more frequencies if needed */}
              </RadioGroup>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveAutoSnapshots} disabled={isSavingAutoSnapshot || !hasAutoSnapshotChanges || (!settings.billing?.subscriptionActive && editedAutoSnapshot.enabled)}>
            {isSavingAutoSnapshot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Auto-Snapshot Settings
          </Button>
          {!settings.billing?.subscriptionActive && editedAutoSnapshot.enabled && (
              <p className="ml-4 text-sm text-red-500">An active subscription is required to enable automated snapshots.</p>
          )}
        </CardFooter>
      </Card>


      {/* Notification Settings Card */}
      <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
        <AccordionItem value="item-1">
          <AccordionTrigger className='text-lg font-semibold'>
            <div className="flex items-center">
                <Bell className="h-5 w-5 mr-2" /> Notification Preferences
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-none shadow-none">
              <CardHeader className="px-1 pt-4">
                <CardDescription>Choose how you want to be notified about snapshot activity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-1">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="emailOnSuccess" className="flex flex-col space-y-1">
                    <span>Snapshot Success</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Receive an email when a snapshot completes successfully.
                    </span>
                  </Label>
                  <Switch 
                    id="emailOnSuccess" 
                    checked={editedNotifications.emailOnSnapshotSuccess} 
                    onCheckedChange={(value: boolean) => handleNotificationChange('emailOnSnapshotSuccess', value)} 
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="emailOnFailure" className="flex flex-col space-y-1">
                    <span>Snapshot Failure</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Receive an email if a snapshot fails.
                    </span>
                  </Label>
                  <Switch 
                    id="emailOnFailure" 
                    checked={editedNotifications.emailOnSnapshotFailure} 
                    onCheckedChange={(value: boolean) => handleNotificationChange('emailOnSnapshotFailure', value)}
                  />
                </div>
                {/* Webhook URL - Future Feature - Uncomment when ready 
                <div>
                  <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                  <Input 
                    id="webhookUrl" 
                    type="url" 
                    placeholder="https://your-webhook-endpoint.com/notify"
                    value={editedNotifications.webhookUrl || ""} 
                    onChange={(e) => handleNotificationChange('webhookUrl', e.target.value)} 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a URL to receive POST notifications for snapshot events (JSON payload).
                  </p>
                </div>
                */}
              </CardContent>
              <CardFooter className="px-1 pb-1">
                <Button onClick={handleSaveNotifications} disabled={isSavingNotifications || !hasNotificationChanges}>
                  {isSavingNotifications && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Notification Settings
                </Button>
              </CardFooter>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Billing and Subscription Card - B.3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" /> Billing & Subscription
          </CardTitle>
          <CardDescription>Manage your subscription and view billing history. Handled by Stripe.</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.billing?.subscriptionActive ? (
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Status: Active ({settings.billing?.subscriptionPlan || 'Pro Plan'})</p>
              {settings.billing?.subscriptionPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Renews on: {new Date(settings.billing?.subscriptionPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Status: No active subscription.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleManageSubscription}>
            {settings.billing?.subscriptionActive ? 'Manage Subscription' : 'View Plans'}
          </Button>
        </CardFooter>
      </Card>

      {/* Referral Program Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gift className="h-5 w-5 mr-2" /> Refer & Earn
          </CardTitle>
          <CardDescription>Share Notion Lifeline with friends and earn rewards!</CardDescription>
        </CardHeader>
        <CardContent>
          {isReferralLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : referralCode && referralLink ? (
            <div className="space-y-2">
              <p className="text-sm">Your unique referral link:</p>
              <div className="flex items-center space-x-2">
                <Input type="text" value={referralLink} readOnly className="font-mono" />
                <Button variant="outline" size="icon" onClick={handleCopyReferralCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link. For every friend who signs up and subscribes, you both get benefits!
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Referral program details coming soon.</p>
          )}
        </CardContent>
      </Card>

      {/* More settings sections can be added here */}
      <div className="pt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <Button variant="link" asChild>
            <Link href="/help" className="flex items-center">
                <HelpCircle className="h-4 w-4 mr-1" /> Help & Support
            </Link>
        </Button>
        {/* Add sign out if needed, or handle via Clerk's UserButton */}
      </div>
    </div>
  );
};

// The main page component that Next.js renders
const SettingsPage = () => {
  return (
    <Suspense fallback={<div className="container mx-auto p-4"><LoadingFallback message="Loading settings page..." /></div>}>
      <SettingsPageContent />
    </Suspense>
  );
};

export default SettingsPage; 