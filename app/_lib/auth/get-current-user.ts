import { headers } from "next/headers";
import { auth } from "@/app/_lib/auth/auth";

/**
 * Get current user from Better Auth session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    const user = session.user;

    return {
      id: user.id,
      email: user.email,
      role: (user as Record<string, unknown>).role as string || "patient",
    };
  } catch {
    return null;
  }
}

/**
 * Require current user and role.
 * Throws if not authenticated or wrong role.
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
