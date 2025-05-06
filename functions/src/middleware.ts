import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', // Protect the dashboard and any sub-routes
  '/api(.*)',       // Protect all API routes by default (except specific public ones if needed)
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect(); // If the route is protected, enforce authentication
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets and _next routes
  // Required for Clerk to function correctly
  matcher: [ '/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}; 