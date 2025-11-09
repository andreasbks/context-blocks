import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { PREVIEW_MODE_ENABLED } from "@/lib/config";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/api/webhooks(.*)",
  "/preview-access",
  "/api/preview-access",
]);

const isPreviewAccessRoute = createRouteMatcher([
  "/preview-access",
  "/api/preview-access",
]);

export default clerkMiddleware(async (auth, req) => {
  // Preview mode check - must come first
  if (PREVIEW_MODE_ENABLED) {
    const isAccessRoute = isPreviewAccessRoute(req);
    const hasPreviewAccess =
      req.cookies.get("preview_access_granted")?.value === "true";

    // If trying to access preview-access page but already has access, redirect to home
    if (
      isAccessRoute &&
      hasPreviewAccess &&
      req.nextUrl.pathname === "/preview-access"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // If doesn't have access and not on access route, redirect to preview-access
    if (!hasPreviewAccess && !isAccessRoute) {
      const url = new URL("/preview-access", req.url);
      return NextResponse.redirect(url);
    }
  }

  // Clerk authentication check
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
