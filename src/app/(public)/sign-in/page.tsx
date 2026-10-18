import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return (
    <div className="auth-page">
      <AuthForm
        mode="sign-in"
        next={safeNextPath(typeof next === "string" ? next : undefined)}
      />
    </div>
  );
}
