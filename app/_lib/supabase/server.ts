import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/app/_lib/auth/auth";

/**
 * Gets the current user session via Better Auth.
 * Returns the same shape consumed throughout the app:
 *   { id, email, role, name }
 * or null if not authenticated.
 *
 * Uses React cache() to deduplicate calls within the same request.
 */
export const getServerSession = cache(async () => {
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
      name: user.name || null,
    };
  } catch (error: unknown) {
    console.error("Error getting server session:", error);
    return null;
  }
});
