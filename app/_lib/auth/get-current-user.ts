import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/app/_lib/supabase/server";
import { db } from "@/app/_lib/db/drizzle/index";
import { users } from "@/app/_lib/db/drizzle/schema";

/**
 * Get current user from Supabase auth and load role from users table
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Get user role from users table
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!userRecord[0]) {
    // Fallback to metadata if not in users table
    const role = (user.user_metadata?.role as string) || "patient";
    return {
      id: user.id,
      email: user.email || "",
      role,
    };
  }

  return {
    id: userRecord[0].id,
    email: userRecord[0].email,
    role: userRecord[0].role || "patient",
  };
}

/**
 * Require current user and role
 * Throws if not authenticated or wrong role
 */
export async function requireUser(allowedRoles?: string[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error("Forbidden");
  }

  return user;
}
