import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: {
    default: "Morphix Styles — AI-crafted styles for any website",
    template: "%s — Morphix Styles",
  },
  description: "Discover, share, and install AI-powered custom styles for any website.",
  keywords: ["morphix", "styles", "userstyles", "css themes", "browser extension", "AI styles"],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Morphix Styles",
    title: "Morphix Styles — AI-crafted styles for any website",
    description: "Discover, share, and install AI-powered custom styles for any website.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
            <div className="max-w-6xl mx-auto px-4">
              <p>Morphix Styles · Open source · CC BY-SA 4.0</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
