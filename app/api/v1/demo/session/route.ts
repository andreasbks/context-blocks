import { cookies } from "next/headers";

import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import {
  DEMO_MAX_AGE_SECONDS,
  DEMO_SESSION_COOKIE,
  createDemoUser,
  getDemoUserFromCookie,
} from "@/lib/demo/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: Request): string {
  const forwarded =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = checkWriteRateLimit(`demo:${ip}`, "POST /v1/demo/session", 10);
  if (rl) return rl;

  const { log } = createRequestLogger(req, {
    route: "POST /v1/demo/session",
    userId: `demo:${ip}`,
  });

  // If there's already a valid demo session, return it
  const existing = await getDemoUserFromCookie();
  if (existing) {
    log.info({ event: "demo_session_reuse", userId: existing.id });
    return Response.json({ userId: existing.id, isNew: false });
  }

  // Create a new demo user and set the cookie
  try {
    const user = await createDemoUser();
    log.info({ event: "demo_session_create", userId: user.id });

    const cookieStore = await cookies();
    cookieStore.set(DEMO_SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });

    return Response.json({ userId: user.id, isNew: true });
  } catch (err) {
    log.error({ event: "demo_session_error", error: err });
    return Response.json(
      { error: { code: "INTERNAL", message: "Failed to create demo session" } },
      { status: 500 }
    );
  }
}
