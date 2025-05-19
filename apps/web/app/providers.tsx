'use client';

import { ClerkProvider } from '@clerk/nextjs';
import React from 'react'; // Import React

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
} 