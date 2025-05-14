import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoadingAuth: boolean; // To handle initial check
  // In a real app, you might store user profile info here
  // user: UserProfile | null; 
  checkAuthState: () => Promise<void>; // Function to check auth status on load
  appSignOut: () => void; // Function to update context on sign out
  // signIn: () => void; // Placeholder if needed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true); // Start true

  // Function to check initial authentication status (e.g., by trying to get a token)
  const checkAuthState = async () => {
    setIsLoadingAuth(true);
    try {
      // We need an IPC call to main to check if a token exists via keytar
      // For now, let's assume we'll add: window.electronAPI.getAuthStatus()
      const authStatus = await window.electronAPI?.getAuthStatus?.(); 
      setIsAuthenticated(!!authStatus?.isAuthenticated);
      // if (authStatus?.isAuthenticated && authStatus.userId) {
      //   // Potentially fetch user profile here or store userId
      // }
    } catch (error) {
      console.error("[AuthContext] Error checking auth state:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };
  
  // Function to be called when IPC 'user-signed-out' is received
  const appSignOut = () => {
    setIsAuthenticated(false);
    // Clear any other user-related state here
  };

  useEffect(() => {
    checkAuthState(); // Check auth status when provider mounts

    const handleUserSignedOut = () => {
      console.log('[AuthContext] Received user-signed-out event via electronAPI.');
      appSignOut();
    };

    let cleanupListener: (() => void) | undefined;
    if (window.electronAPI && typeof window.electronAPI.onUserSignedOut === 'function') {
      cleanupListener = window.electronAPI.onUserSignedOut(handleUserSignedOut);
    }

    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoadingAuth, checkAuthState, appSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Placeholder for UserProfile type if you add it
// interface UserProfile {
//   id: string;
//   email?: string;
//   // other fields
// }

// REMOVED The global declaration from here as it's now in electron.d.ts
// declare global {
//   interface Window {
//     electronAPI?: {
//       // ... other existing methods
//       getAuthStatus?: () => Promise<{ isAuthenticated: boolean; userId?: string | null }>;
//       onUserSignedOut?: (callback: () => void) => (() => void) | undefined; 
//     };
//   }
// } 