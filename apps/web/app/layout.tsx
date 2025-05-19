import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import Providers from './providers';
import ActualErrorBoundary from "@/components/ActualErrorBoundary";
import { PostHogProvider } from "@/components/PostHogProvider";
import SiteBanner from "@/components/SiteBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Notion Lifeline | Automatic Backups & 1-Click Restore for Notion",
  description: "Never lose a Notion doc again. Automatic hourly snapshots, AI change-diff emails, and 1-click restore to protect your valuable Notion workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground">
        <Providers>
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ActualErrorBoundary>
                <SiteBanner />
                {children} 
                <Toaster />
              </ActualErrorBoundary>
            </ThemeProvider>
          </PostHogProvider>
        </Providers>
      </body>
    </html>
  );
} 