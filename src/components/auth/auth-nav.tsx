"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sessionApi } from "@/components/sessions/session-api";

interface Me {
  userId: string;
  displayName: string;
}

/** Header account control. Re-checks on every route change so it follows sign-in/out. */
export function AuthNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    sessionApi<Me | null>("/api/auth/me")
      .then((result) => !stale && setMe(result))
      .catch(() => !stale && setMe(null));
    return () => {
      stale = true;
    };
  }, [pathname]);

  async function signOut() {
    await sessionApi("/api/auth/sign-out", {}).catch(() => {});
    setMe(null);
    router.push("/");
    router.refresh();
  }

  if (me === undefined) return <span className="auth-nav" aria-hidden="true" />;
  if (!me)
    return (
      <span className="auth-nav">
        <Link href="/sign-in" className="nav-link">
          Iniciar sesión
        </Link>
        <Link href="/sign-up" className="action action-primary auth-cta">
          Crear cuenta
        </Link>
      </span>
    );
  return (
    <span className="auth-nav">
      <span className="auth-name">{me.displayName}</span>
      <button type="button" onClick={signOut} className="nav-link auth-signout">
        Salir
      </button>
    </span>
  );
}
