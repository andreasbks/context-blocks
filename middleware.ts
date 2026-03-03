import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/try",
  "/auth(.*)",
  "/api/webhooks(.*)",
  "/api/v1/demo(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  // Allow requests with a demo-session cookie through;
  // requireOwner() will validate the cookie against the DB.
  const demoSession = req.cookies.get("demo-session");
  if (demoSession?.value) return;

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
