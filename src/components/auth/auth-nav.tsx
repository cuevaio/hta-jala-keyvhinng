"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Wallet } from "lucide-react";
import { sessionApi } from "@/components/sessions/session-api";
import { formatSoles } from "@/modules/payments/domain/fees";

interface Me {
  userId: string;
  displayName: string;
  creditBalanceMinor: number;
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

  const cta = (
    <Link href="/ride" className="action action-primary action-small">
      Compartir un taxi
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );

  if (me === undefined)
    return <span className="auth-nav auth-nav-loading" aria-hidden="true" />;
  if (!me)
    return (
      <span className="auth-nav">
        <Link href="/sign-in" className="nav-link">
          Iniciar sesión
        </Link>
        {cta}
      </span>
    );
  return (
    <span className="auth-nav">
      <span className="auth-name">{me.displayName}</span>
      <span className="auth-balance" title="Tu saldo en Jala">
        <Wallet size={15} aria-hidden="true" />
        <span className="sr-only">Saldo:</span>
        {formatSoles(me.creditBalanceMinor)}
      </span>
      <button type="button" onClick={signOut} className="nav-link auth-signout">
        Salir
      </button>
      {cta}
    </span>
  );
}
