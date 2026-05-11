import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Morphix Styles — AI-crafted styles for any website",
    template: "%s — Morphix Styles",
  },
  description:
    "Discover, share, and install AI-powered custom styles for any website. Browse styles created by the community, or share your own with one click from the Morphix extension.",
  keywords: [
    "morphix", "styles", "userstyles", "css themes",
    "website themes", "browser extension", "AI styles",
    "custom CSS", "dark mode", "restyle",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Morphix Styles",
    title: "Morphix Styles — AI-crafted styles for any website",
    description:
      "Discover, share, and install AI-powered custom styles for any website.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('morphix-theme');
                  if (t === 'light' || (!t && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
            <div className="max-w-6xl mx-auto px-4">
              <p>Morphix Styles — Built with ❤️ by Arzuparreta</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
