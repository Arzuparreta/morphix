"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/client";
import { Sun, Moon, Search, Upload, User, LogOut } from "lucide-react";

interface UserProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function Navbar() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          username: (session.user.user_metadata?.username as string) || session.user.email?.split("@")[0] || "User",
          display_name: (session.user.user_metadata?.display_name as string) || null,
          avatar_url: null,
        });
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          username: (authUser.user_metadata?.username as string) || authUser.email?.split("@")[0] || "User",
          display_name: (authUser.user_metadata?.display_name as string) || null,
          avatar_url: null,
        });
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const displayName = user?.display_name || user?.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

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

        <div className="flex-1" />

        {/* Search */}
        <form action="/search" className="hidden md:flex items-center relative w-64">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input name="q" placeholder="Search styles..." className="pl-8 h-9 text-sm" />
        </form>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Auth */}
        {loading ? (
          <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm">{displayName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
                {user.username}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/${user.username}`)} className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                My profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/upload")} className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload style
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer !text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
