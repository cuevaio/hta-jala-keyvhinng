import { AuthPage } from "@/components/auth/auth-page";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { googleSignInHref } from "@/components/auth/google-href";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function Page({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  return (
    <AuthPage>
      <AuthForm
        mode="sign-up"
        next={next}
        googleHref={googleSignInHref(next)}
      />
    </AuthPage>
  );
}
