"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { auth } from "@/app/_lib/auth/auth";
import { db } from "@/app/_lib/db/drizzle/index";
import { users } from "@/app/_lib/db/drizzle/schema";
import { and, eq, ilike, or } from "drizzle-orm";

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: "doctor" | "nurse" | "admin";
}

/**
 * Create a new user (doctor or nurse) via Better Auth admin API,
 * then update the role in our users table via Drizzle.
 */
export async function createUserAction(payload: CreateUserPayload) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (
    session.role !== "doctor" &&
    session.role !== "nurse" &&
    session.role !== "admin"
  ) {
    throw new Error(
      "Unauthorized: Only doctors, nurses, and admins can create users"
    );
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "A user with this email already exists",
      };
    }

    const newUser = await auth.api.createUser({
      headers: await headers(),
      body: {
        email: payload.email,
        password: payload.password,
        name: payload.name,
        role: "user",
      },
    });

    if (!newUser?.user) {
      return {
        success: false,
        error: "Failed to create user",
      };
    }

    await db
      .update(users)
      .set({ role: payload.role })
      .where(eq(users.id, newUser.user.id));

    return {
      success: true,
      userId: newUser.user.id,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

export async function searchProvidersAction(query: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (
    session.role !== "doctor" &&
    session.role !== "nurse" &&
    session.role !== "admin"
  ) {
    throw new Error("Unauthorized");
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const likeQuery = `%${normalizedQuery}%`;

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "doctor"),
        or(ilike(users.name, likeQuery), ilike(users.email, likeQuery))
      )
    )
    .limit(5);
}
