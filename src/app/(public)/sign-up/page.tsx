import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/modules/auth/schemas/auth.schema";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function Page({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return (
    <div className="auth-page">
      <AuthForm
        mode="sign-up"
        next={safeNextPath(typeof next === "string" ? next : undefined)}
      />
    </div>
  );
}
