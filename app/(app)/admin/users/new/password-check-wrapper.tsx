"use client";

import { useRouter } from "next/navigation";
import { PasswordCheck } from "./password-check";

export function PasswordCheckWrapper() {
  const router = useRouter();

  const handlePasswordCorrect = () => {
    // Reload the page to re-check the cookie
    router.refresh();
  };

  return <PasswordCheck onPasswordCorrect={handlePasswordCorrect} />;
}
