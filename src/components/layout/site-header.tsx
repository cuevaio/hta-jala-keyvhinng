"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AuthNav } from "@/components/auth/auth-nav";

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
      <div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="Jala, inicio">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path
              d="M9 8v13a7 7 0 0 0 14 0V14"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="9" cy="7" r="4" fill="currentColor" />
            <circle cx="23" cy="10" r="4" fill="currentColor" />
          </svg>
          Jala
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={24} aria-hidden="true" />
          ) : (
            <Menu size={24} aria-hidden="true" />
          )}
        </button>
        <div id="site-menu" className="site-menu">
          <nav aria-label="Principal">
            <Link
              href="/places"
              className="nav-link"
              aria-current={pathname.startsWith("/places") ? "page" : undefined}
            >
              Lugares
            </Link>
            <Link href="/#como-funciona" className="nav-link">
              Cómo funciona
            </Link>
          </nav>
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
