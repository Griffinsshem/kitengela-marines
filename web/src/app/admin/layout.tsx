import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { AuthProvider } from "@/components/admin/AuthProvider";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Marines Admin" },
  // The club's own workspace has no business in search results.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
