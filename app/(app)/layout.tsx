"use client"; // Make this a client component

import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import React, { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import apiClient from "@/lib/apiClient";

// Static metadata can be defined here, but if it needs to be dynamic
// based on auth state, other patterns might be needed.
// For now, we keep it simple if it was static before.
// export const metadata: Metadata = {
//   title: "Notion Lifeline - App",
//   description: "Manage your Notion backups and settings.",
// };

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      const ensureUserDocument = async () => {
        try {
          console.log('[AppLayout] Ensuring user document exists for:', userId);
          // Using apiClient, assuming it handles response parsing (e.g., to JSON)
          const response = await apiClient('/api/user/ensure-created', {
            method: 'POST',
            // No body needed for this specific POST as user is identified by session
          });
          console.log('[AppLayout] Ensure user document response:', response);
          // If response indicates new user created, could trigger other onboarding actions here
        } catch (error) {
          console.error('[AppLayout] Error ensuring user document:', error);
          // Handle error appropriately, e.g., show a toast to the user
        }
      };
      ensureUserDocument();
    }
  }, [isLoaded, isSignedIn, userId]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 