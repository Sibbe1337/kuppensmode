"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // For API key input
import { Label } from "@/components/ui/label";   // For form labels
import { Switch } from "@/components/ui/switch"; // For toggles
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // For organizing sections
import { ExternalLink, KeyRound, Bell, LogOut, HelpCircle, ShieldCheck, Loader2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { useUserSettings } from '@/hooks/useUserSettings'; // Corrected hook import
import type { UserSettings } from '@/types/user'; // Corrected type import
import { useSearchParams } from 'next/navigation'; // Import useSearchParams

const SettingsPage = () => {
  const { settings, isLoading, isError, mutateSettings } = useUserSettings();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  console.log("SettingsPage: Rendering with settings:", settings, "isLoading:", isLoading, "isError:", isError);

  const [isDisconnectingNotion, setIsDisconnectingNotion] = React.useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = React.useState(false);
  const [editedNotifications, setEditedNotifications] = React.useState(settings?.notifications || {
    emailOnSnapshotSuccess: true,
    emailOnSnapshotFailure: true,
    webhookUrl: "",
  });
  const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);

  // Effect to check for post-Notion-connection redirect
  React.useEffect(() => {
    const notionQueryParam = searchParams.get('notion');
    const errorQueryParam = searchParams.get('error');

    console.log("SettingsPage: useEffect for query params fired. notionQueryParam:", notionQueryParam, "errorQueryParam:", errorQueryParam);

    if (notionQueryParam === 'connected') {
      console.log("SettingsPage: Detected notion=connected. Will call mutateSettings() after short delay.");
      toast({ title: "Success", description: "Notion workspace connected successfully!" });
      
      // Add a small delay before revalidating
      const timer = setTimeout(() => {
        console.log("SettingsPage: Calling mutateSettings() after delay.");
        mutateSettings(); 
      }, 250); // Delay of 250ms - adjust if needed

      // Clean the URL immediately
      window.history.replaceState(null, '', '/dashboard/settings');

      // Cleanup the timer if the component unmounts before it fires
      return () => clearTimeout(timer);

    } else if (errorQueryParam) {
      console.log("SettingsPage: Detected error query param:", errorQueryParam);
      // ... (error handling toast logic) ...
       window.history.replaceState(null, '', '/dashboard/settings');
    }
  // Restore dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mutateSettings, toast]);

  React.useEffect(() => {
    if (settings?.notifications) {
      setEditedNotifications(settings.notifications);
    }
  }, [settings?.notifications]);

  const handleNotionConnect = () => {
    console.log("Redirecting to Notion OAuth initiation endpoint...");
    // Redirect to the backend route that starts the OAuth flow
    window.location.href = '/api/auth/notion/start'; // Assuming this is the endpoint name
    // Remove simulation logic:
    // setSettings(prev => ({
    //   ...prev,
    //   notionConnected: true,
    //   notionWorkspaceName: "Acme Corp Workspace (Simulated)"
    // }));
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
      mutateSettings(); // Revalidate user settings
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
      // Assuming the API returns the new key or the settings endpoint will have it after mutation
      // const data = await response.json(); 
      // const newApiKey = data.apiKey; 
      toast({ title: "Success", description: "API Key regenerated successfully." });
      mutateSettings(); // Revalidate to get the new API key and other settings
    } catch (error: any) {
      console.error("Error regenerating API key:", error);
      toast({ title: "Error", description: error.message || "Could not regenerate API key.", variant: "destructive" });
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleNotificationChange = (
    key: keyof UserSettings['notifications'],
    value: boolean | string | null
  ) => {
    setEditedNotifications((prev: UserSettings['notifications']) => ({
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
      mutateSettings(); // Revalidate settings to confirm changes
    } catch (error: any) {
      console.error("Error saving notifications:", error);
      toast({ title: "Error", description: error.message || "Failed to save preferences.", variant: "destructive" });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const hasNotificationChanges = React.useMemo(() => {
    if (!settings?.notifications) return false; // If initial settings not loaded, assume no changes
    return JSON.stringify(settings.notifications) !== JSON.stringify(editedNotifications);
  }, [settings?.notifications, editedNotifications]);

  if (isLoading) {
    console.log("SettingsPage: Rendering LOADING state.");
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading settings...</p>
      </div>
    );
  }

  if (isError || !settings) {
    console.log("SettingsPage: Rendering ERROR or NO SETTINGS state.");
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center px-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Failed to Load Settings</h2>
        <p className="text-muted-foreground mb-6">
          We couldn't retrieve your settings at this time. Please check your internet connection and try again.
        </p>
        <Button onClick={() => mutateSettings()} className="flex items-center">
          <Loader2 className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : 'hidden'}`} />
          Try Again
        </Button>
        {isError && (
            <Card className="mt-6 w-full max-w-md text-left">
                <CardHeader><CardTitle className="text-base">Error Details</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground overflow-auto">
                    <pre>{JSON.stringify(isError.info || { message: isError.message }, null, 2)}</pre>
                </CardContent>
            </Card>
        )}
      </div>
    );
  }

  if (settings.notionConnected) {
    console.log("SettingsPage: Rendering CONNECTED Notion state.");
  } else {
    console.log("SettingsPage: Rendering DISCONNECTED Notion state.");
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-semibold">Settings</h1>

      <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
        {/* Notion Integration Section */}
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg">
            <div className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" /> Notion Integration
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Notion Workspace</CardTitle>
                <CardDescription>
                  Connect your Notion workspace to allow Notion Lifeline to create snapshots.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.notionConnected ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-700">
                    <div>
                        <p className="font-medium text-green-700 dark:text-green-300">Successfully connected!</p>
                        <p className="text-sm text-muted-foreground">Workspace: {settings.notionWorkspaceName || 'Not specified'}</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleNotionDisconnect} disabled={isDisconnectingNotion}>
                      {isDisconnectingNotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleNotionConnect} className="w-full md:w-auto">
                    Connect Notion Workspace
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  By connecting, you agree to grant Notion Lifeline read access to your workspace metadata and page content for backup purposes.
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* API Key Management Section */}
        <AccordionItem value="item-2">
          <AccordionTrigger className="text-lg">
            <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> API Key Management
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your API Key</CardTitle>
                <CardDescription>
                  Use this key to interact with the Notion Lifeline API (if applicable).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-grow">
                    <Label htmlFor="apiKey">Current Key</Label>
                    <Input id="apiKey" type="text" value={settings.apiKey || '-'} readOnly />
                  </div>
                  <Button 
                    variant="secondary" 
                    onClick={handleGenerateApiKey} 
                    disabled={isRegeneratingKey}
                    > 
                      {isRegeneratingKey ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Regenerate
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Treat your API key like a password. Do not share it publicly.
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications Section */}
        <AccordionItem value="item-3">
          <AccordionTrigger className="text-lg">
            <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notifications
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you receive notifications from Notion Lifeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 p-3 border rounded-md">
                  <Label htmlFor="emailOnSnapshotSuccess" className="flex flex-col space-y-1">
                    <span>Email on Snapshot Success</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Receive an email when a snapshot completes successfully.
                    </span>
                  </Label>
                  <Switch 
                    id="emailOnSnapshotSuccess" 
                    checked={editedNotifications.emailOnSnapshotSuccess}
                    onCheckedChange={(checked) => handleNotificationChange('emailOnSnapshotSuccess', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 p-3 border rounded-md">
                  <Label htmlFor="emailOnSnapshotFailure" className="flex flex-col space-y-1">
                    <span>Email on Snapshot Failure</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Receive an email if a snapshot fails to complete.
                    </span>
                  </Label>
                  <Switch 
                    id="emailOnSnapshotFailure" 
                    checked={editedNotifications.emailOnSnapshotFailure}
                    onCheckedChange={(checked) => handleNotificationChange('emailOnSnapshotFailure', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                  <Input 
                    id="webhookUrl" 
                    type="url" 
                    placeholder="https://api.example.com/your-webhook-endpoint"
                    value={editedNotifications.webhookUrl || ''}
                    onChange={(e) => handleNotificationChange('webhookUrl', e.target.value || null)}
                  />
                   <p className="text-xs text-muted-foreground mt-1">
                    Enter a URL to receive webhook notifications for snapshot events.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                    <Button 
                        onClick={handleSaveNotifications} 
                        disabled={!hasNotificationChanges || isSavingNotifications}
                    >
                        {isSavingNotifications ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Save Preferences
                    </Button>
              </CardFooter>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Other sections like Security, Help, Sign Out could go here */}

      </Accordion>
    </div>
  );
};

export default SettingsPage; 