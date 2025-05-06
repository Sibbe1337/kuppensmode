import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ClerkProvider } from '@clerk/nextjs';
import ErrorBoundary from "@/components/ErrorBoundary";
import { PostHogProvider } from "@/components/PostHogProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Notion Lifeline",
  description: "Your lifeline for Notion data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
        <body className="h-full bg-background text-foreground">
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ErrorBoundary>
                <div className="flex h-full">
                  <Sidebar />
                  <div className="flex-1 flex flex-col overflow-y-auto">
                    <Navbar />
                    <main className="flex-1 p-6">
                      {children}
                    </main>
                  </div>
                </div>
                <Toaster />
              </ErrorBoundary>
            </ThemeProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
} 