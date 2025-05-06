"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Using 'any' for props temporarily due to ongoing type resolution issues with next-themes/dist/types.
export function ThemeProvider({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
} 