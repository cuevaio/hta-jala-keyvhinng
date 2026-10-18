import type { Metadata } from "next";
import { AdminSimulator } from "@/components/journey/admin-simulator";
export const metadata: Metadata = { title: "Simulador de agrupamiento" };
export default function AdminPage() {
  return <AdminSimulator />;
}
