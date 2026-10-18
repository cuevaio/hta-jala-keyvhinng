import { AuthPage } from "@/components/auth/auth-page";
import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  // The token is in the URL; keep it out of Referer headers sent elsewhere.
  referrer: "no-referrer",
};

export default async function Page({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  return (
    <AuthPage>
      <PasswordResetForm
        mode="confirm"
        token={typeof token === "string" ? token : ""}
      />
    </AuthPage>
  );
}
