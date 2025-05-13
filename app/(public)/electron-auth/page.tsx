'use client';

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

console.log('[ElectronAuthPage] Script start - Pre-component evaluation'); // Even earlier log

// Declare the electronAPI on the window object for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, payload: any) => void;
    };
  }
}

export default function ElectronAuthPage() {
  console.log('[ElectronAuthPage] Component boot');
  console.log('[ElectronAuthPage] typeof window.electronAPI:', typeof (window as any).electronAPI, 'Value:', (window as any).electronAPI);

  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();

  useEffect(() => {
    console.log('[ElectronAuthPage] useEffect triggered. isLoaded:', isLoaded, 'isSignedIn:', isSignedIn, 'sessionId:', sessionId);
    if (!isLoaded || !isSignedIn || !sessionId) {
      if (isLoaded && !isSignedIn) {
        console.log('[ElectronAuthPage] Loaded but not signed in yet, Clerk <SignIn/> should be active.');
      }
      return;
    }

    console.log('[ElectronAuthPage] Clerk session loaded and user is signed in. Session ID:', sessionId);

    (async () => {
      console.log('[ElectronAuthPage] Entering async block in useEffect to get token.');
      try {
        // Request a short-lived JWT. 
        // Ensure you have a JWT template named "desktop_app" in your Clerk dashboard, 
        // or use a default template if available (e.g., await getToken(); for the session token).
        // The template defines the claims and lifetime of this specific JWT.
        console.log('[ElectronAuthPage] Attempting to get token with template: desktop_app');
        const jwt = await getToken({ template: "desktop_app" }); 

        if (!jwt) {
          console.error('[ElectronAuthPage] Failed to retrieve JWT from Clerk. getToken returned null or undefined.');
          if (window.electronAPI?.send) {
            window.electronAPI.send("clerk-auth-error", { error: "Failed to retrieve JWT from Clerk (null/undefined)" });
          }
          return;
        }

        console.log(`[ElectronAuthPage] JWT received from Clerk (length: ${jwt.length}), attempting to send to Electron main process.`);
        
        if (window.electronAPI?.send) {
          window.electronAPI.send("clerk-auth-success", {
            sessionId,
            token: jwt, // This is the JWT for your backend API
          });
          console.log('[ElectronAuthPage] Sent clerk-auth-success IPC message with session and token.');
          // Optionally, this page could now show a "Signing in to desktop app..." message
          // or automatically attempt to close if Electron doesn't close the window upon message receipt.
        } else {
          console.warn('[ElectronAuthPage] electronAPI not found on window. Cannot send token to Electron main process via IPC.');
          // Fallback for non-Electron environments or if preload script failed:
          // alert('Authentication successful. Please return to the PageLifeline desktop app. If this window doesn\'t close automatically, you may close it.');
        }
      } catch (error: any) {
        console.error('[ElectronAuthPage] Error in getToken or sending IPC message:', error.message, error.stack, error);
        if (window.electronAPI?.send) {
          window.electronAPI.send("clerk-auth-error", { error: error.message || "Unknown error during token retrieval or IPC send" });
        }
      }
    })();
  }, [isLoaded, isSignedIn, sessionId, getToken]);

  if (!isLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading authentication state...</div>; // Or your standard loading component
  }

  // If already signed in and token has been sent (or attempted), 
  // you might want to show a message like "Authenticating with desktop app... you can close this window."
  // Or, if the IPC message closes the window, this UI might only flash briefly.
  if (isSignedIn && sessionId) {
    // This part will be visible briefly if the window isn't closed immediately by Electron main
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>Authenticating with PageLifeline Desktop...</h1>
        <p>Session ID: {sessionId}</p>
        <p>Attempting to finalize... If this window doesn&apos;t close automatically, please check the main app logs.</p>
      </div>
    );
  }

  // Show Clerk's <SignIn /> component to handle the actual sign-in process
  // The `path` and `routing` props ensure Clerk handles routing correctly for this page.
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <SignIn path="/electron-auth" routing="path" />
    </div>
  );
} 