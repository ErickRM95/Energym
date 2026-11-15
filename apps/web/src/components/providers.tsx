"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } }));
  const pathname = usePathname();
  const guest = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/acceso");
  return (
    <QueryClientProvider client={client}>
      {guest ? (
        <div className="fixed right-4 top-4 z-20 w-44">
          <ThemeToggle />
        </div>
      ) : null}
      {children}
    </QueryClientProvider>
  );
}
