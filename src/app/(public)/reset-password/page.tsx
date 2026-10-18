import { AuthPage } from "@/components/auth/auth-page";
import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { getServices } from "@/lib/services";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  // The token is in the URL; keep it out of Referer headers sent elsewhere.
  referrer: "no-referrer",
};

export default async function Page({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  return (
    <AuthPage>
      <PasswordResetForm
        mode="confirm"
        token={value}
        accountEmail={await getServices().auth.resetAccountEmail(value)}
      />
    </AuthPage>
  );
}
