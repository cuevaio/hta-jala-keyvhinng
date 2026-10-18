import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function Page() {
  return (
    <div className="auth-page">
      <PasswordResetForm mode="request" />
    </div>
  );
}
