import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`wordmark ${className}`}
      aria-label="Jala, inicio"
    >
      jala<span aria-hidden="true">↗</span>
    </Link>
  );
}
