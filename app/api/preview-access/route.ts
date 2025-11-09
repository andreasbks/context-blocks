import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { PREVIEW_MODE_PASSWORD } from "@/lib/config";

const PREVIEW_ACCESS_COOKIE = "preview_access_granted";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Verify password
    if (password === PREVIEW_MODE_PASSWORD) {
      const cookieStore = await cookies();

      // Set secure cookie
      cookieStore.set(PREVIEW_ACCESS_COOKIE, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    // Invalid password
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  } catch (error) {
    console.error("Preview access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
