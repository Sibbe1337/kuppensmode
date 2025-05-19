"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

// Using 'any' for props temporarily due to ongoing type resolution issues with next-themes/dist/types.
// export function ThemeProvider({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
//   return <NextThemesProvider {...props}>{children}</NextThemesProvider>
// }

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: React.ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
} 