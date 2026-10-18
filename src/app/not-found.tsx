import { NotFoundMessage } from "@/components/layout/not-found-message";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Unmatched URLs render outside every route group, so this brings its own chrome.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="site-main">
        <NotFoundMessage />
      </main>
      <SiteFooter />
    </>
  );
}
