import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const PASSWORD_COOKIE_NAME = "new_user_access_granted";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    const expectedPassword = process.env.NEW_USER_PWD;

    if (!expectedPassword) {
      return NextResponse.json(
        { error: "Password protection not configured" },
        { status: 500 }
      );
    }

    if (password === expectedPassword) {
      // Set a cookie to remember the access for 1 hour
      const cookieStore = await cookies();
      cookieStore.set(PASSWORD_COOKIE_NAME, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Password verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
