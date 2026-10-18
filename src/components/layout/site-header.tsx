import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight text-primary"
        >
          Jala
        </Link>
        <nav
          aria-label="Principal"
          className="flex items-center gap-1 text-sm font-medium"
        >
          <Link href="/events" className="rounded-md px-3 py-2 hover:bg-muted">
            Eventos
          </Link>
        </nav>
      </div>
    </header>
  );
}
