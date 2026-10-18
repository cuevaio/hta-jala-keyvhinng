import { AuthPage } from "@/components/auth/auth-page";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { googleSignInHref } from "@/components/auth/google-href";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const googleError =
    typeof params.error === "string" ? params.error : undefined;
  return (
    <AuthPage>
      <AuthForm
        mode="sign-in"
        next={next}
        googleHref={googleSignInHref(next)}
        googleError={googleError}
      />
    </AuthPage>
  );
}
