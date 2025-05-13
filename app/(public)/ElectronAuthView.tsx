"use client";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

// Declare the electronAPI on the window object for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, payload: any) => void;
      // Add other methods if your preload exposes them and this view needs them
    };
  }
}

export default function ElectronAuthView() {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  console.log('[ElectronAuthView] States:', { isLoaded, isSignedIn, sessionId });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    console.log('[ElectronAuthView] Clerk session loaded, attempting to get token and send to main.');
    (async () => {
      try {
        // Ensure you have a JWT template named "desktop_app" in your Clerk dashboard
        const jwt = await getToken({ template: "desktop_app" }); 
        if (window.electronAPI?.send && jwt) {
          console.log('[ElectronAuthView] Token acquired, sending clerk-auth-success');
          window.electronAPI.send("clerk-auth-success", { sessionId, token: jwt });
        } else if (!jwt) {
            console.error('[ElectronAuthView] getToken returned null or undefined.');
            window.electronAPI?.send("clerk-auth-error", { error: "Failed to retrieve token from Clerk (null/undefined)."});
        } else if (!window.electronAPI?.send) {
            console.error('[ElectronAuthView] window.electronAPI.send is not available. Preload script might have failed.');
        }
      } catch (error:any) {
        console.error("[ElectronAuthView] Error in getToken or sending IPC message:", error);
        window.electronAPI?.send("clerk-auth-error", { error: error.message || "Unknown error during token retrieval."});
      }
    })();
  }, [isLoaded, isSignedIn, sessionId, getToken]);

  // This should render the Clerk Sign In UI
  // Ensure your Clerk instance is configured to handle the /electron-auth path
  return <SignIn path="/electron-auth" routing="path" />;
}
