"use client";

import { useState, useEffect, useCallback } from 'react';

const SANDBOX_FLAG_KEY = 'pagelifelineSandbox';

export function useSandbox(): boolean {
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    // Ensure localStorage is accessed only on the client side
    if (typeof window !== 'undefined') {
      const sandboxFlag = window.localStorage.getItem(SANDBOX_FLAG_KEY);
      setIsSandbox(sandboxFlag === '1');
    }
  }, []);

  // Optional: provide a way to listen to storage changes if the flag might change
  // during the session by means other than page reload (e.g., dev tools).
  const handleStorageChange = useCallback((event: StorageEvent) => {
    if (event.key === SANDBOX_FLAG_KEY) {
      setIsSandbox(event.newValue === '1');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [handleStorageChange]);

  return isSandbox;
}

// Helper function to set the sandbox flag (e.g., called by the /demo route)
export function setSandboxMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      window.localStorage.setItem(SANDBOX_FLAG_KEY, '1');
    } else {
      window.localStorage.removeItem(SANDBOX_FLAG_KEY);
    }
    // Dispatch a storage event so that other tabs/instances of useSandbox update
    window.dispatchEvent(new StorageEvent('storage', {
      key: SANDBOX_FLAG_KEY,
      newValue: enabled ? '1' : null,
      storageArea: window.localStorage,
    }));
  }
} 