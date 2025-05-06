"use client"; // Error boundaries must be client components

import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode; // Optional custom fallback UI
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    eventId: null,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, eventId: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Capture the error with Sentry, storing the event ID
    const eventId = Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    this.setState({ eventId });
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-background">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold text-destructive mb-4">Oops! Something went wrong.</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              We apologize for the inconvenience. Our team has been notified of this issue.
              Please try refreshing the page. If the problem persists, please contact support.
            </p>
            <div className="flex gap-4">
                <Button variant="outline" onClick={() => window.location.reload()}>Refresh Page</Button>
                {/* Optional: Button to report feedback, including the eventId */}
                {/* {this.state.eventId && (
                    <Button onClick={() => Sentry.showReportDialog({ eventId: this.state.eventId! })}>
                        Report Feedback
                    </Button>
                )} */}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 