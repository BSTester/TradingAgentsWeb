import { NextResponse, type NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/', '/auth'];

// Define protected routes that require authentication  
const protectedRoutes = ['/dashboard', '/analysis', '/history', '/settings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get token from cookies or localStorage simulation
  // Note: middleware can't access localStorage, so we rely on cookies
  const token = request.cookies.get('access_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');

  const isPublicRoute = publicRoutes.some(route => 
    route === pathname || (route === '/' && pathname === '/')
  );
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // For protected routes without token, let the page handle redirect
  // This allows React components to check localStorage
  if (isProtectedRoute && !token) {
    // Don't redirect here, let client-side handle it
    return NextResponse.next();
  }

  // Allow all public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};