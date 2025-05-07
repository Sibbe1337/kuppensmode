import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="bg-slate-100 dark:bg-gray-800 border-b border-border text-primary p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold">Notion Lifeline</div>
        <div className="flex items-center gap-4">
          <SignedIn>
            {/* Navigation links can go here when signed in */}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            {/* Optionally, show limited links or a marketing message when signed out */}
            <SignInButton mode="modal">
              <Button variant="outline">Sign In</Button>
            </SignInButton>
          </SignedOut>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 