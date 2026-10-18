"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AuthNav } from "@/components/auth/auth-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`site-header${open ? " menu-open" : ""}`}>
      <div className="site-header-inner wrap">
        <Wordmark eager />
        <NotificationBell key={pathname} />
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </button>
        <div id="site-menu" className="site-menu">
          <nav aria-label="Principal">
            <Link href="/" className="nav-link">
              Inicio
            </Link>
            <Link
              href="/places"
              className="nav-link"
              aria-current={pathname.startsWith("/places") ? "page" : undefined}
            >
              Lugares
            </Link>
          </nav>
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
