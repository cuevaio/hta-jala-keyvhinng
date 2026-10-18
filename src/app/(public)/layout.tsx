import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Marketing and live-ride pages share the site header and footer. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="site-main">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
