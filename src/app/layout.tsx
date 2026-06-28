import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans-variable", // globals.css: @theme { --font-sans: var(--font-sans-variable) }
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-variable", // globals.css: @theme { --font-mono: var(--font-mono-variable) }
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Préstamos Elicar",
  description:
    "Préstamos Elicar — Microfinanzas y Soluciones Crediticias. Panel operativo de gestión de cartera.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable, // inyecta --font-sans-variable en el <body>
          geistMono.variable, // inyecta --font-mono-variable en el <body>
          "min-h-screen antialiased text-foreground",
        )}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
