import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Energym",
  description: "Portal de gestión para gimnasios",
  icons: { icon: "/energym-mark.svg" },
};

export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("energym-theme")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`,
          }}
        />
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
