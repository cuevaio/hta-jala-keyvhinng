import Image from "next/image";
import Link from "next/link";

export function Wordmark({
  className = "",
  eager = false,
}: {
  className?: string;
  /** The header logo is above the fold on every page. */
  eager?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`wordmark ${className}`}
      aria-label="Jala, inicio"
    >
      {/* The link carries the accessible name; the image is decorative. */}
      <Image
        src="/jala-logo.png"
        alt=""
        width={104}
        height={48}
        loading={eager ? "eager" : "lazy"}
      />
    </Link>
  );
}
