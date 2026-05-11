"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Search } from "lucide-react";

export function Navbar() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground text-sm font-extrabold">
            M
          </span>
          <span className="hidden sm:inline">Morphix Styles</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1 text-sm">
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            Explore
          </Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <form
          action="/search"
          className="hidden md:flex items-center relative w-64"
        >
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="q"
            placeholder="Search styles..."
            className="pl-8 h-9 text-sm"
          />
        </form>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Auth placeholder */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
