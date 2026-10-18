import { AuthPage } from "@/components/auth/auth-page";
import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function Page() {
  return (
    <AuthPage>
      <PasswordResetForm mode="request" />
    </AuthPage>
  );
}
