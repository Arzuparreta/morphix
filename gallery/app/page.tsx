import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Download, Palette, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 md:py-28 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Now in open beta
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Style the web{" "}
            <span className="text-primary">together</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Discover AI-crafted custom styles for any website. Share your own,
            install with one click, and make the internet look exactly how you
            want.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 text-sm font-medium"
            >
              Browse styles
            </Link>
            <a
              href="https://github.com/Arzuparreta/morphix"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-5 text-sm font-medium"
            >
              Get the extension
            </a>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6 text-center">
            <Palette className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">AI-powered styles</h3>
            <p className="text-sm text-muted-foreground">
              Describe what you want and Morphix generates the CSS and JavaScript
              instantly.
            </p>
          </Card>
          <Card className="p-6 text-center">
            <Download className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">One-click install</h3>
            <p className="text-sm text-muted-foreground">
              Find a style you like? Click install and it's applied immediately
              through the extension.
            </p>
          </Card>
          <Card className="p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Community-driven</h3>
            <p className="text-sm text-muted-foreground">
              Rate, comment, and curate collections. The best styles rise to the
              top.
            </p>
          </Card>
        </div>
      </section>

      {/* Popular sites */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Popular sites</h2>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            View all →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {["YouTube", "Reddit", "GitHub", "Twitter", "Gmail", "Wikipedia", "Discord"].map(
            (site) => (
              <Badge key={site} variant="outline" className="text-sm px-3 py-1.5 cursor-pointer hover:bg-accent">
                <Link href={`/explore?site=${site.toLowerCase()}.com`}>{site}</Link>
              </Badge>
            ),
          )}
        </div>
      </section>

      {/* Trending / placeholder cards */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Trending this week</h2>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            View all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StyleCardPlaceholder key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StyleCardPlaceholder() {
  return (
    <Card className="overflow-hidden group cursor-pointer">
      <div className="aspect-[16/10] bg-muted flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Coming soon</p>
      </div>
      <div className="p-3 space-y-1">
        <p className="font-semibold text-sm truncate">Style name</p>
        <p className="text-xs text-muted-foreground truncate">youtube.com</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>by Author</span>
        </div>
      </div>
    </Card>
  );
}
