import type { ReactNode } from "react";
import { RouteVisual } from "@/components/home/route-visual";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <RouteVisual />
      <div className="auth-page-form">{children}</div>
    </div>
  );
}
