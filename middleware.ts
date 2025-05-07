import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
// createRouteMatcher may not be needed if publicRoutes are defined directly.

// Define routes that should be publicly accessible
const isPublicRoute = createRouteMatcher([
  '/', // <-- Make the landing page public
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/stripe/webhook(.*)', // Ensure Stripe webhook route is public
  '/api/clerk/webhook(.*)', // <--- ADD THIS LINE to make Clerk webhook public
  // Add other public routes like landing page ('/') if needed
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (!isPublicRoute(req)) {
    const { userId } = await auth(); // Await the auth() call
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      // console.log('>>> Middleware (Manual Redirect): Redirecting unauthenticated user to sign-in'); // Optional logging
      return NextResponse.redirect(signInUrl);
    }
  }
  return NextResponse.next(); 
});

export const config = {
  // Matcher ensures middleware runs on relevant paths
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)', // Matches general paths, excluding static files and _next
    '/', // Matches the root path
    '/(api|trpc)(.*)', // Matches API routes
  ],
}; 