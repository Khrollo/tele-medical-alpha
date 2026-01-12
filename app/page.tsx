import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";

export default async function Home() {
  const session = await getServerSession();

  // If not authenticated, redirect to sign in
  if (!session) {
    redirect("/sign-in");
  }

  // Redirect based on role
  if (session.role === "doctor") {
    redirect("/waiting-room");
  }

  if (session.role === "nurse") {
    redirect("/patients");
  }

  // Fallback: if authenticated but unknown role, redirect to sign in
  redirect("/sign-in");
}
